// Executive console on a computer: src/app/(app)/admin, src/lib/insights.ts, the desktop sidebar.
const executive: Record<string, string> = {
  // sidebar
  "ภาพรวมผู้บริหาร": "Executive overview",
  "ติดตาม": "Monitor",
  "งานประจำวัน": "Daily work",
  "วัตถุดิบและหมวด": "Items & categories",
  "ราคาทุนและ Par": "Cost & Par",

  // overview: KPI tiles
  "ตัวเลขสำคัญ": "Key figures",
  "ของขาดจากการนับ": "Count shortage",
  "นับเกิน {v}": "Counted over by {v}",
  "นับได้น้อยกว่ายอดที่ควรมี": "Counted less than expected",
  "ตามราคาทุน": "At cost",
  "นับครบตามกำหนด": "Counts done on time",
  "{a}/{b} จุด-วัน": "{a}/{b} location-days",
  "ช่วงก่อนหน้าไม่มีข้อมูล": "No data for the previous period",
  "เท่ากับช่วงก่อนหน้า": "Same as the previous period",
  "{sign}{p}% จากช่วงก่อนหน้า": "{sign}{p}% vs previous period",
  "{sign}{p} จุดจากช่วงก่อนหน้า": "{sign}{p} pts vs previous period",

  // overview: charts and lists
  "ความสูญเสียรายวัน": "Daily loss",
  "ของขาดจากการนับ + ของเสีย ตามราคาทุน": "Count shortage + waste, at cost",
  "เรื่องที่ต้องตัดสินใจ": "Needs a decision",
  "ของหมด {n} รายการ": "{n, # item, # items} out of stock",
  "ต่ำกว่า Par ต้องสั่ง {n} รายการ": "{n, # item, # items} below Par to reorder",
  "ยังไม่ได้นับ {n} จุด-วัน": "{n, # location-day, # location-days} not counted",
  "ดูตารางการนับด้านล่าง": "See the count grid below",
  "มูลค่าคงคลังรายวัน": "Stock value by day",
  "ยอดนับล่าสุดของทุกรายการ × ราคาทุน ณ สิ้นวัน": "Latest count of every item × cost, at the end of each day",
  "มูลค่าคงคลังตามจุดเก็บ": "Stock value by location",
  "ณ {day}": "As of {day}",
  "ตารางการนับรายวัน": "Daily count grid",
  "แต่ละช่อง = จุดเก็บหนึ่งจุดในหนึ่งวัน ชี้เพื่อดูสถานะ": "Each cell is one location on one day. Hover to see its status.",
  "ไม่ได้นับ": "Not counted",
  "รายการที่สูญเสียมากสุด": "Biggest losses",
  "เรียงตามมูลค่า ของขาด + ของเสีย": "By value of shortage + waste",
  "ไม่มีความสูญเสียในช่วงนี้": "No losses in this period",
  "ของขาด": "Short",
  "มูลค่ารวม": "Total value",
  "ของเสียตามสาเหตุ": "Waste by reason",
  "รวม {v}": "Total {v}",
  "ไม่มีของเสียในช่วงนี้": "No waste in this period",
  "ดูรายการรับ · เบิก · โอน · ของเสีย ›": "See receiving · issues · transfers · waste ›",

  // stock report + cost grid
  "ทุกจุดเก็บ": "All locations",
  "ทุกรายการ": "All items",
  "เฉพาะที่มีส่วนต่าง": "With variance only",
  "เฉพาะที่ต่ำกว่า Par": "Below Par only",
  "ไม่พบรายการที่ตรงกับตัวกรอง": "No items match the filters",
  "รวม {n} รายการ": "{n, # item, # items} in total",
  "แก้ได้หลายรายการแล้วกดบันทึกครั้งเดียว ราคาทุนใช้คิดมูลค่าคงคลังและความสูญเสีย Par ใช้แจ้งเตือนของต่ำ ทุกการแก้ไขเก็บในประวัติการแก้ไข":
    "Edit as many items as you like, then save once. Cost drives stock value and loss; Par drives low-stock alerts. Every change is kept in the edit history.",
  "แสดงรายการที่ปิดใช้งาน": "Show inactive items",
  "ยังไม่ได้ใส่ราคาทุน {n} รายการ มูลค่าคงคลังและความสูญเสียจะต่ำกว่าจริง":
    "{n, # item has, # items have} no cost yet, so stock value and loss read low",
  "คงเหลือล่าสุด": "Last count",
  "ราคาทุน (฿)": "Cost (฿)",
  "Par ของ {name}": "Par for {name}",
  "ราคาทุนของ {name}": "Cost of {name}",
  "ราคาทุนและ Par ต้องเป็นตัวเลข 0 ขึ้นไป": "Cost and Par must be numbers, 0 or more",
  "บันทึก {n} รายการ": "Save {n, # item, # items}",
  "บันทึกแล้ว {n} รายการ": "Saved {n, # item, # items}",
  "ยังไม่มีรายการที่แก้": "Nothing has been changed",
};

export default executive;
