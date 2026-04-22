/**
 * Seed hierarchical categories (2 levels) — idempotent by unique `name`.
 * Uses Category.create so pre('save') generates slugs.
 *
 * Usage (from backend/): node scripts/seedCategories.js
 * Or: npm run seed:categories
 * Validate names only (no DB): node scripts/seedCategories.js --check-names
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const Category = require('../src/models/category.model');

const MAX_NAME = 50;

/** @type {Array<{ key: string, name: string, description?: string, image?: string }>} */
const ROOT_CATEGORIES = [
  {
    key: 'dienTu',
    name: 'Điện tử',
    description: 'Các sản phẩm điện tử, công nghệ',
    image: '',
  },
  {
    key: 'thoiTrang',
    name: 'Thời trang',
    description: 'Quần áo, giày dép, phụ kiện thời trang',
    image: '',
  },
  {
    key: 'nhaCuaDoiSong',
    name: 'Nhà cửa & Đời sống',
    description: 'Đồ dùng gia đình, nội thất, trang trí',
    image: '',
  },
  {
    key: 'sach',
    name: 'Sách',
    description: 'Sách các thể loại',
    image: '',
  },
  {
    key: 'theThaoDuLich',
    name: 'Thể thao & Du lịch',
    description: 'Dụng cụ thể thao, đồ du lịch, dã ngoại',
    image: '',
  },
  {
    key: 'sucKhoeLamDep',
    name: 'Sức khỏe & Làm đẹp',
    description: 'Mỹ phẩm, chăm sóc cá nhân, thực phẩm chức năng',
    image: '',
  },
  {
    key: 'doChoiChoBe',
    name: 'Đồ chơi cho bé',
    description: 'Đồ chơi trẻ em, giáo dục, giải trí',
    image: '',
  },
  {
    key: 'oToXeMayXeDap',
    name: 'Ô tô – Xe máy – Xe đạp',
    description: 'Phụ tùng, phụ kiện xe',
    image: '',
  },
  {
    key: 'hangTieuDungThucPham',
    name: 'Hàng tiêu dùng & Thực phẩm',
    description: 'Thực phẩm, đồ uống, hàng khô',
    image: '',
  },
  {
    key: 'dienGiaDung',
    name: 'Điện gia dụng',
    description: 'Đồ dùng điện trong gia đình',
    image: '',
  },
  {
    key: 'thuCung',
    name: 'Thú cưng',
    description: 'Đồ dùng, thức ăn cho thú cưng',
    image: '',
  },
];

/** @type {Array<{ parentKey: string, name: string, description?: string, image?: string }>} */
const CHILD_CATEGORIES = [
  // Điện tử
  { parentKey: 'dienTu', name: 'Điện thoại & Phụ kiện' },
  { parentKey: 'dienTu', name: 'Máy tính & Laptop' },
  { parentKey: 'dienTu', name: 'TV, Âm thanh & Thiết bị nghe nhìn' },
  { parentKey: 'dienTu', name: 'Máy ảnh – Quay phim' },
  { parentKey: 'dienTu', name: 'Phụ kiện công nghệ' },
  { parentKey: 'dienTu', name: 'Thiết bị văn phòng' },

  // Thời trang
  { parentKey: 'thoiTrang', name: 'Thời trang nam' },
  { parentKey: 'thoiTrang', name: 'Thời trang nữ' },
  { parentKey: 'thoiTrang', name: 'Giày dép nam & nữ' },
  { parentKey: 'thoiTrang', name: 'Túi xách – Ví – Balo thời trang' },
  { parentKey: 'thoiTrang', name: 'Trang sức – Phụ kiện thời trang' },
  { parentKey: 'thoiTrang', name: 'Đồng hồ' },

  // Nhà cửa & Đời sống
  { parentKey: 'nhaCuaDoiSong', name: 'Nội thất phòng khách, phòng ngủ' },
  { parentKey: 'nhaCuaDoiSong', name: 'Trang trí nhà cửa' },
  { parentKey: 'nhaCuaDoiSong', name: 'Đồ dùng nhà bếp' },
  { parentKey: 'nhaCuaDoiSong', name: 'Dụng cụ & Thiết bị gia đình' },
  { parentKey: 'nhaCuaDoiSong', name: 'Đồ dùng phòng tắm & giặt giũ' },

  // Sách
  { parentKey: 'sach', name: 'Sách văn học – Tiểu thuyết' },
  { parentKey: 'sach', name: 'Sách kinh tế – Quản trị' },
  { parentKey: 'sach', name: 'Sách thiếu nhi – Truyện tranh' },
  { parentKey: 'sach', name: 'Sách ngoại ngữ – Từ điển' },
  { parentKey: 'sach', name: 'Sách kỹ năng sống – Nuôi dạy con' },

  // Thể thao & Du lịch
  { parentKey: 'theThaoDuLich', name: 'Dụng cụ thể thao' },
  { parentKey: 'theThaoDuLich', name: 'Balo – Túi du lịch – Vali' },
  { parentKey: 'theThaoDuLich', name: 'Đồ dùng dã ngoại' },
  { parentKey: 'theThaoDuLich', name: 'Xe đạp & Phụ kiện' },

  // Sức khỏe & Làm đẹp
  { parentKey: 'sucKhoeLamDep', name: 'Chăm sóc da mặt' },
  { parentKey: 'sucKhoeLamDep', name: 'Trang điểm' },
  { parentKey: 'sucKhoeLamDep', name: 'Dụng cụ chăm sóc cá nhân' },
  { parentKey: 'sucKhoeLamDep', name: 'Thực phẩm chức năng – Vitamin' },
  { parentKey: 'sucKhoeLamDep', name: 'Nước hoa' },

  // Đồ chơi cho bé
  { parentKey: 'doChoiChoBe', name: 'Đồ chơi giáo dục' },
  { parentKey: 'doChoiChoBe', name: 'Đồ chơi mô hình – Siêu nhân' },
  { parentKey: 'doChoiChoBe', name: 'Đồ chơi ngoài trời' },
  { parentKey: 'doChoiChoBe', name: 'Búp bê & Phụ kiện' },

  // Ô tô – Xe máy – Xe đạp
  { parentKey: 'oToXeMayXeDap', name: 'Phụ tùng xe máy' },
  { parentKey: 'oToXeMayXeDap', name: 'Phụ kiện ô tô' },
  { parentKey: 'oToXeMayXeDap', name: 'Dầu nhớt – Hóa chất' },
  { parentKey: 'oToXeMayXeDap', name: 'Thiết bị bảo hộ' },

  // Hàng tiêu dùng & Thực phẩm
  { parentKey: 'hangTieuDungThucPham', name: 'Đồ uống – Nước giải khát' },
  { parentKey: 'hangTieuDungThucPham', name: 'Thực phẩm khô – Đồ hộp' },
  { parentKey: 'hangTieuDungThucPham', name: 'Bánh kẹo – Snack' },
  { parentKey: 'hangTieuDungThucPham', name: 'Gia vị – Nguyên liệu nấu ăn' },

  // Điện gia dụng
  { parentKey: 'dienGiaDung', name: 'Tủ lạnh – Máy giặt' },
  { parentKey: 'dienGiaDung', name: 'Điều hòa – Quạt điều hòa' },
  { parentKey: 'dienGiaDung', name: 'Máy hút bụi – Robot hút bụi' },
  { parentKey: 'dienGiaDung', name: 'Lò vi sóng – Lò nướng – Bếp từ' },

  // Thú cưng
  { parentKey: 'thuCung', name: 'Thức ăn cho chó – mèo' },
  { parentKey: 'thuCung', name: 'Phụ kiện cho thú cưng' },
  { parentKey: 'thuCung', name: 'Sữa tắm – Vệ sinh cho thú cưng' },
];

function assertNameLengths() {
  const all = [
    ...ROOT_CATEGORIES.map((r) => r.name),
    ...CHILD_CATEGORIES.map((c) => c.name),
  ];
  const bad = all.filter((n) => n.length > MAX_NAME);
  if (bad.length) {
    throw new Error(
      `Category name(s) exceed ${MAX_NAME} chars: ${bad.join(' | ')}`
    );
  }
}

/**
 * @param {{ name: string, description?: string, image?: string, parent?: import('mongoose').Types.ObjectId | null, isActive?: boolean }} data
 */
async function ensureCategory(data) {
  const existing = await Category.findOne({ name: data.name });
  if (existing) {
    return existing;
  }
  return Category.create({
    name: data.name,
    description: data.description,
    image: data.image !== undefined ? data.image : '',
    parent: data.parent ?? null,
    isActive: data.isActive !== false,
  });
}

async function seed() {
  assertNameLengths();

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set. Add it to backend/.env');
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10_000,
  });
  console.log('Connected to MongoDB');

  /** @type {Map<string, import('mongoose').Document>} */
  const keyToCategory = new Map();

  for (const row of ROOT_CATEGORIES) {
    const doc = await ensureCategory({
      name: row.name,
      description: row.description,
      image: row.image ?? '',
      parent: null,
      isActive: true,
    });
    keyToCategory.set(row.key, doc);
    console.log(`Root: ${row.name} (${doc._id})`);
  }

  for (const row of CHILD_CATEGORIES) {
    const parentDoc = keyToCategory.get(row.parentKey);
    if (!parentDoc) {
      throw new Error(`Unknown parentKey: ${row.parentKey}`);
    }
    const doc = await ensureCategory({
      name: row.name,
      description: row.description,
      image: row.image ?? '',
      parent: parentDoc._id,
      isActive: true,
    });
    console.log(`Child: ${row.name} -> parent ${parentDoc.name} (${doc._id})`);
  }

  const total = await Category.countDocuments();
  console.log(`Done. Total categories in DB: ${total}`);
}

if (process.argv.includes('--check-names')) {
  try {
    assertNameLengths();
    console.log(
      `OK: ${ROOT_CATEGORIES.length} roots + ${CHILD_CATEGORIES.length} children — all names <= ${MAX_NAME} chars.`
    );
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
  process.exit(0);
}

seed()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });
