/** RFC 4180: bọc nháy kép khi có dấu phẩy, nháy kép hoặc xuống dòng; nháy kép được nhân đôi. */
export function escapeCsvField(value: string): string {
  return /[",\r\n]/u.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function csvRow(fields: readonly string[]): string {
  return `${fields.map(escapeCsvField).join(',')}\r\n`;
}
