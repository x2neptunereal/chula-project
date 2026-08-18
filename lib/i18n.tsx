"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "th";

// ─── Dictionary ──────────────────────────────────────────────────────────────
const dict = {
  // Brand / nav
  nav_overview: { en: "Overview", th: "ภาพรวม" },
  nav_expenses: { en: "Expenses", th: "รายจ่าย" },
  nav_income: { en: "Income", th: "รายรับ" },
  nav_admin: { en: "Admin", th: "ผู้ดูแลระบบ" },
  sign_out: { en: "Sign out", th: "ออกจากระบบ" },
  change_name: { en: "Change name", th: "เปลี่ยนชื่อ" },
  name_updated: { en: "Name updated", th: "เปลี่ยนชื่อสำเร็จ" },
  name_update_failed: { en: "Failed to update name", th: "เปลี่ยนชื่อไม่สำเร็จ" },

  // Login page
  welcome_back: { en: "Welcome back", th: "ยินดีต้อนรับกลับ" },
  signin_subtitle: { en: "Sign in to your MONEX account", th: "เข้าสู่ระบบบัญชี MONEX ของคุณ" },
  email: { en: "Email", th: "อีเมล" },
  password: { en: "Password", th: "รหัสผ่าน" },
  sign_in: { en: "Sign in", th: "เข้าสู่ระบบ" },
  no_account: { en: "Don't have an account?", th: "ยังไม่มีบัญชี?" },
  sign_up: { en: "Sign up", th: "สมัครสมาชิก" },

  // Signup page
  create_account_title: { en: "Create an account", th: "สร้างบัญชีใหม่" },
  create_account_subtitle: { en: "Start tracking your entropy today", th: "เริ่มติดตามการเงินของคุณวันนี้" },
  username: { en: "Username", th: "ชื่อผู้ใช้" },
  confirm_password: { en: "Confirm password", th: "ยืนยันรหัสผ่าน" },
  create_account: { en: "Create account", th: "สร้างบัญชี" },
  already_have_account: { en: "Already have an account?", th: "มีบัญชีอยู่แล้ว?" },
  passwords_no_match: { en: "Passwords do not match", th: "รหัสผ่านไม่ตรงกัน" },
  password_too_short: { en: "Password must be at least 6 characters", th: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" },
  unable_to_connect: { en: "Unable to connect. Please try again.", th: "ไม่สามารถเชื่อมต่อได้ กรุณาลองใหม่" },
  something_went_wrong: { en: "Something went wrong", th: "เกิดข้อผิดพลาด" },

  // Overview
  overview_title: { en: "Overview", th: "ภาพรวม" },
  overview_subtitle: { en: "Your financial summary", th: "สรุปข้อมูลการเงินของคุณ" },
  total_income: { en: "Total Income", th: "รายรับทั้งหมด" },
  total_expenses: { en: "Total Expenses", th: "รายจ่ายทั้งหมด" },
  balance: { en: "Balance", th: "ยอดคงเหลือ" },
  transactions: { en: "Transactions", th: "รายการธุรกรรม" },
  clear: { en: "Clear", th: "ล้างตัวกรอง" },
  search_placeholder: { en: "Search...", th: "ค้นหา..." },
  all_types: { en: "All types", th: "ทุกประเภท" },
  income_only: { en: "Income only", th: "รายรับเท่านั้น" },
  expenses_only: { en: "Expenses only", th: "รายจ่ายเท่านั้น" },
  start_date: { en: "Start date", th: "วันที่เริ่มต้น" },
  end_date: { en: "End date", th: "วันที่สิ้นสุด" },
  no_match_filters: { en: "No transactions match your filters", th: "ไม่พบรายการที่ตรงกับตัวกรอง" },
  no_transactions_yet: { en: "No transactions yet", th: "ยังไม่มีรายการธุรกรรม" },
  income: { en: "Income", th: "รายรับ" },
  expense: { en: "Expense", th: "รายจ่าย" },
  edit_transaction: { en: "Edit transaction", th: "แก้ไขรายการ" },
  type: { en: "Type", th: "ประเภท" },
  amount_thb: { en: "Amount (THB)", th: "จำนวนเงิน (บาท)" },
  date: { en: "Date", th: "วันที่" },
  description_optional: { en: "Description (optional)", th: "คำอธิบาย (ไม่บังคับ)" },
  cancel: { en: "Cancel", th: "ยกเลิก" },
  save_changes: { en: "Save changes", th: "บันทึกการแก้ไข" },
  tx_deleted: { en: "Transaction deleted", th: "ลบรายการแล้ว" },
  tx_delete_failed: { en: "Failed to delete transaction", th: "ลบรายการไม่สำเร็จ" },
  tx_updated: { en: "Transaction updated", th: "อัปเดตรายการแล้ว" },
  tx_update_failed: { en: "Failed to update transaction", th: "อัปเดตรายการไม่สำเร็จ" },
  tx_load_failed: { en: "Failed to load transactions", th: "โหลดรายการไม่สำเร็จ" },
  eg_grocery: { en: "e.g. Grocery shopping", th: "เช่น ค่าซื้อของใช้" },

  // Expenses page
  record_expenses: { en: "Record Expenses", th: "บันทึกรายจ่าย" },
  record_expenses_subtitle: { en: "Enter manually or upload bank slips", th: "กรอกข้อมูลเองหรืออัปโหลดสลิปธนาคาร" },
  manual_entry: { en: "Manual Entry", th: "บันทึกด้วยตนเอง" },
  manual_entry_subtitle: { en: "Enter expense details directly", th: "กรอกรายละเอียดรายจ่ายโดยตรง" },
  eg_grocery_bill: { en: "e.g. Grocery shopping, Electricity bill…", th: "เช่น ค่าซื้อของใช้, ค่าไฟ…" },
  expense_category: { en: "Type of Expenses", th: "ประเภทของค่าใช้จ่าย" },
  select_category: { en: "Select category", th: "เลือกประเภท" },
  category_entertainment: { en: "Entertainment", th: "ความบันเทิง" },
  category_shopping: { en: "Shopping", th: "ช้อปปิ้ง" },
  category_investment_transport_recurring: {
    en: "Investment / Transport / Recurring",
    th: "ลงทุน ค่าเดินทาง ค่าใช้จ่ายประจำ",
  },
  category_basic_utilities: { en: "Basic Utilities", th: "สาธารณูปโภคขั้นพื้นฐาน" },
  confirm_save: { en: "Confirm & Save", th: "ยืนยันและบันทึก" },
  saved: { en: "Saved!", th: "บันทึกแล้ว!" },
  upload_slips: { en: "Upload Bank Slips", th: "อัปโหลดสลิปธนาคาร" },
  upload_slips_subtitle: {
    en: "Supports Krungthai, TrueMoney, and K-Bank. Duplicate slips are automatically detected.",
    th: "รองรับกรุงไทย, ทรูมันนี่, และ K-Bank ระบบตรวจจับสลิปซ้ำให้อัตโนมัติ",
  },
  drop_slips: { en: "Drop slip images here or click to browse", th: "วางรูปสลิปที่นี่ หรือคลิกเพื่อเลือกไฟล์" },
  drop_slips_formats: { en: "JPG, PNG, WEBP — multiple files supported", th: "JPG, PNG, WEBP — รองรับหลายไฟล์" },
  slips_loaded: { en: "slip(s) loaded", th: "สลิปที่โหลดแล้ว" },
  scan_slips: { en: "Scan", th: "สแกน" },
  confirm_expenses: { en: "Confirm", th: "ยืนยัน" },
  expense_s: { en: "expense(s)", th: "รายการ" },
  slip_s: { en: "slip(s)", th: "สลิป" },
  transaction_no: { en: "Transaction No.", th: "เลขที่ธุรกรรม" },
  bank: { en: "Bank", th: "ธนาคาร" },
  show_raw_ocr: { en: "Show raw OCR text", th: "แสดงข้อความ OCR ดิบ" },
  hide_raw_ocr: { en: "Hide raw OCR text", th: "ซ่อนข้อความ OCR ดิบ" },
  valid_amount: { en: "Please enter a valid amount", th: "กรุณากรอกจำนวนเงินให้ถูกต้อง" },
  expense_recorded: { en: "Expense recorded", th: "บันทึกรายจ่ายแล้ว" },
  expense_save_failed: { en: "Failed to save expense", th: "บันทึกรายจ่ายไม่สำเร็จ" },
  slip_duplicate_msg: { en: "This slip has already been recorded.", th: "สลิปนี้ถูกบันทึกไปแล้ว" },
  clear_retry: { en: "Clear & retry", th: "ล้างและลองใหม่" },
  pending_scan: { en: "Pending scan", th: "รอสแกน" },
  scanning: { en: "Scanning…", th: "กำลังสแกน…" },
  ready: { en: "Ready", th: "พร้อม" },
  duplicate: { en: "Duplicate", th: "ซ้ำ" },
  error: { en: "Error", th: "ผิดพลาด" },
  no_slips_to_scan: { en: "No slips to scan", th: "ไม่มีสลิปให้สแกน" },
  scanned_slips: { en: "Scanned", th: "สแกนแล้ว" },
  no_confirmed_slips: { en: "No confirmed slips to save", th: "ไม่มีสลิปที่ยืนยันให้บันทึก" },
  saved_from_slips: { en: "expense(s) saved from slips", th: "รายการที่บันทึกจากสลิป" },
  invalid_amount_for_slip: { en: "Invalid amount for slip", th: "จำนวนเงินไม่ถูกต้องสำหรับสลิป" },
  slip_save_failed: { en: "Failed to save slip", th: "บันทึกสลิปไม่สำเร็จ" },
  network_error_slip: { en: "Network error saving slip", th: "เกิดข้อผิดพลาดของเครือข่ายขณะบันทึกสลิป" },
  upload_images_only: { en: "Please upload image files only", th: "กรุณาอัปโหลดเฉพาะไฟล์รูปภาพ" },
  description: { en: "Description", th: "คำอธิบาย" },
  eg_payment_groceries: { en: "e.g. Payment for groceries", th: "เช่น ค่าซื้อของใช้" },
  slip: { en: "Slip", th: "สลิป" },

  // Income page
  record_income: { en: "Record Income", th: "บันทึกรายรับ" },
  record_income_subtitle: { en: "Add income to your account", th: "เพิ่มรายรับให้กับบัญชีของคุณ" },
  new_income_entry: { en: "New Income Entry", th: "เพิ่มรายการรายรับใหม่" },
  fill_details_below: { en: "Fill in the details below", th: "กรอกรายละเอียดด้านล่าง" },
  income_amount: { en: "Income Amount (THB)", th: "จำนวนรายรับ (บาท)" },
  eg_salary: { en: "e.g. Monthly salary, Freelance payment…", th: "เช่น เงินเดือน, ค่าจ้างฟรีแลนซ์…" },
  income_recorded: { en: "Income recorded successfully", th: "บันทึกรายรับสำเร็จ" },
  income_save_failed: { en: "Failed to save income", th: "บันทึกรายรับไม่สำเร็จ" },

  // Date picker
  pick_a_date: { en: "Pick a date", th: "เลือกวันที่" },
  done: { en: "Done", th: "เสร็จสิ้น" },

  // Multi-select / bulk delete
  select: { en: "Select", th: "เลือก" },
  selected_count: { en: "selected", th: "ที่เลือก" },
  select_all: { en: "Select all", th: "เลือกทั้งหมด" },
  deselect_all: { en: "Deselect all", th: "ยกเลิกการเลือกทั้งหมด" },
  delete_selected: { en: "Delete", th: "ลบ" },
  confirm_bulk_delete_title: { en: "Delete transactions?", th: "ลบรายการธุรกรรม?" },
  confirm_bulk_delete_desc: {
    en: "This will permanently delete the selected transactions. This action cannot be undone.",
    th: "การลบนี้จะลบรายการที่เลือกอย่างถาวรและไม่สามารถย้อนกลับได้",
  },
  tx_bulk_deleted: { en: "Transactions deleted", th: "ลบรายการแล้ว" },
  tx_bulk_delete_failed: { en: "Failed to delete transactions", th: "ลบรายการไม่สำเร็จ" },

  // Cash flow chart
  cash_flow: { en: "Cash Flow", th: "กระแสเงินสด" },
  cash_flow_subtitle: {
    en: "Income, expenses and balance over time",
    th: "รายรับ รายจ่าย และยอดคงเหลือตามเวลา",
  },
  range_7d: { en: "7D", th: "7 วัน" },
  range_30d: { en: "30D", th: "30 วัน" },
  range_90d: { en: "90D", th: "90 วัน" },
  range_all: { en: "All", th: "ทั้งหมด" },
  no_chart_data: { en: "No data to display", th: "ไม่มีข้อมูลให้แสดง" },

  // Admin page
  admin_title: { en: "Admin Panel", th: "แผงควบคุมผู้ดูแลระบบ" },
  admin_subtitle: {
    en: "View any user's dashboard and export their stats",
    th: "ดูข้อมูลของผู้ใช้ทุกคนและส่งออกสถิติ",
  },
  admin_users: { en: "Users", th: "ผู้ใช้งาน" },
  admin_no_users: { en: "No users found", th: "ไม่พบผู้ใช้งาน" },
  admin_tx_count_suffix: { en: "tx", th: "รายการ" },
  admin_back_to_users: { en: "Back to users", th: "กลับไปหน้ารายชื่อผู้ใช้" },
  admin_last_7_days: { en: "Last 7 days", th: "7 วันล่าสุด" },
  admin_last_30_days: { en: "Last 30 days", th: "30 วันล่าสุด" },
  admin_custom_range: { en: "Custom range", th: "กำหนดช่วงเอง" },
  admin_export_txt: { en: "Export .txt", th: "ส่งออก .txt" },
  export_failed: { en: "Failed to export data", th: "ส่งออกข้อมูลไม่สำเร็จ" },
} as const;

export type DictKey = keyof typeof dict;

// ─── Context ─────────────────────────────────────────────────────────────────
interface LanguageContextValue {
  lang: Lang;
  toggleLang: () => void;
  setLang: (l: Lang) => void;
  t: (key: DictKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const stored = localStorage.getItem("lang");
    const initial: Lang = stored === "th" ? "th" : "en";
    setLangState(initial);
    document.documentElement.classList.toggle("lang-th", initial === "th");
    document.documentElement.lang = initial;
  }, []);

  function applyLang(next: Lang) {
    setLangState(next);
    localStorage.setItem("lang", next);
    document.documentElement.classList.toggle("lang-th", next === "th");
    document.documentElement.lang = next;
  }

  function toggleLang() {
    applyLang(lang === "en" ? "th" : "en");
  }

  function t(key: DictKey): string {
    return dict[key]?.[lang] ?? dict[key]?.en ?? key;
  }

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, setLang: applyLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
