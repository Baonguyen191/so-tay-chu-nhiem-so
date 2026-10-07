// Sắp xếp họ tên theo thứ tự chữ cái tiếng Việt: so tên trước, rồi đến họ và tên đệm.
const collator = new Intl.Collator("vi", { usage: "sort" });

function splitName(full) {
  const parts = String(full || "").trim().split(/\s+/);
  const given = parts.pop() || "";
  return { given, rest: parts.join(" ") };
}

export function compareVietnameseNames(a, b) {
  const x = splitName(a);
  const y = splitName(b);
  return collator.compare(x.given, y.given) || collator.compare(x.rest, y.rest) || collator.compare(a, b);
}

/** Trả về mảng mới đã sắp xếp; getName lấy họ tên từ mỗi phần tử. */
export function sortByVietnameseName(items, getName = (x) => x.fullName) {
  return [...items].sort((a, b) => compareVietnameseNames(getName(a), getName(b)));
}
