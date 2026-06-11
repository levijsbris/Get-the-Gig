// Convert a free-form title into a portfolio slug:
//   - lowercase
//   - strip diacritics (NFD + remove combining marks U+0300..U+036F)
//   - collapse anything that isn't [a-z0-9] into a single hyphen
//   - trim leading/trailing hyphens
//   - cap at 40 characters (the server-side regex limit)
const COMBINING_MARKS_RANGE = /[̀-ͯ]/g;

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_MARKS_RANGE, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}
