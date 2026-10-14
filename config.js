// ตั้งค่าการเชื่อมต่อ Google Sheet — แก้ไฟล์นี้ไฟล์เดียว
window.STATION_CONFIG = {
  API_URL: '',          // วาง URL ของ Apps Script Web app (ลงท้าย /exec) ถ้าว่าง = ใช้ข้อมูลตัวอย่าง
  TOKEN: '',            // ต้องตรงกับ TOKEN ใน Code.gs
  REFRESH_SECONDS: 300, // รีเฟรชข้อมูลทุกกี่วินาที (ขั้นต่ำ 30)
  LOW_STOCK_DAYS: 5     // สต๊อกเหลือน้อยกว่ากี่วัน ให้ขึ้นเตือนสีส้ม
};
