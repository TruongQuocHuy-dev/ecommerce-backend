const AuditLogService = require('../services/auditLog.service');

/**
 * Middleware to automatically log state-changing operations
 * Captures requests and creates audit logs
 */
const auditLogger = (options = {}) => {
    return async (req, res, next) => {
        // Only log state-changing methods
        const stateMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
        if (!stateMethods.includes(req.method)) {
            return next();
        }

        // Skip routes that shouldn't be logged
        const skipRoutes = ['/auth/login', '/auth/logout', '/audit-logs'];
        if (skipRoutes.some((route) => req.path.includes(route))) {
            return next();
        }

        // Capture original res.json to intercept response
        const originalJson = res.json.bind(res);

        res.json = async function (body) {
            // Only log if user context exists
            if (!req.user) {
                return originalJson(body);
            }

            // Determine action based on method and response
            let action = 'UPDATE';
            if (req.method === 'POST') action = 'CREATE';
            if (req.method === 'DELETE') action = 'DELETE';

        // Extract entity from route (first segment, singularized)
        const pathParts = req.path.split('/').filter(Boolean);
        let entityRaw = pathParts[0] || 'unknown';

        // Singularize naive plural only when ending with 's'
        if (entityRaw.endsWith('s') && entityRaw.length > 1) {
            entityRaw = entityRaw.slice(0, -1);
        }

        // Normalize entity name (capitalize)
        const entity =
            entityRaw === 'unknown'
                ? 'Unknown'
                : entityRaw.charAt(0).toUpperCase() + entityRaw.slice(1);

            // Get entity ID from params or body
            const entityId =
                req.params.id ||
                req.params.entityId ||
                req.body._id ||
                req.body.id ||
                body?.data?._id ||
                body?.data?.id;

            // Best-effort shopId resolution
            let shopId = req.body.shopId || req.body.shop || body?.data?.shopId || body?.data?.shop;
            if (!shopId && entity === 'Shop') {
                shopId = entityId;
            }

            // Determine status
            const status = res.statusCode >= 200 && res.statusCode < 300 ? 'success' : 'failed';

            // Create audit log (async, don't wait)
            const logData = {
                userId: req.user.userId,
                userRole: req.user.role,
                action,
                entity,
                entityId,
                shopId,
                ipAddress: req.ip || req.connection.remoteAddress,
                userAgent: req.get('user-agent'),
                status,
                errorMessage: status === 'failed' ? body.message : undefined,
                metadata: {
                    method: req.method,
                    path: req.path,
                    query: req.query,
                },
            };

            // Don't await - log asynchronously
            AuditLogService.createLog(logData).catch((err) => {
                console.error('Failed to create audit log:', err);
            });

            // Call original json method
            return originalJson(body);
        };

        next();
    };
};

/**
 * Helper to manually create audit logs
 */
const createAuditLog = async (data) => {
    return AuditLogService.createLog(data);
};

module.exports = {
    auditLogger,
    createAuditLog,
};
