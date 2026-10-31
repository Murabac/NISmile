"""
M2B TECH LTD styled client checklist for DentaFlow / N.I SMILE demo presentation.
Header and footer match M2B proposal / agreement documents (Hargeisa + London offices).
"""
from datetime import date
from pathlib import Path

from fpdf import FPDF

OUT = Path(__file__).resolve().parent / "M2B-DentaFlow-Client-Demo-Checklist.pdf"

NAVY = (12, 35, 64)  # deep navy used on formal M2B docs
INK = (28, 28, 28)
MUTED = (90, 90, 90)
LINE = (200, 200, 200)
SOFT = (245, 246, 248)
WHITE = (255, 255, 255)
CHECK = (22, 120, 80)

COMPANY = "M2B TECH LTD"
PILLARS = "TECHNOLOGY  |  INNOVATION  |  SOLUTIONS"
DOC_TITLE = "DENTAFLOW STAFF APP"
DOC_KIND = "C L I E N T   D E M O   C H E C K L I S T"
CLIENT = "N.I SMILE Oral care & Teeth whitening"
PREPARED_BY = "M2B TECH LTD"
REF = "DF-CHECK-" + date.today().strftime("%y%m%d")


def ascii(text: str) -> str:
    return (
        text.replace("\u2014", "-")
        .replace("\u2013", "-")
        .replace("\u2018", "'")
        .replace("\u2019", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\u2026", "...")
        .replace("—", "-")
        .replace("–", "-")
        .replace("·", "-")
        .replace("→", "->")
        .replace("□", "[ ]")
        .replace("☐", "[ ]")
    )


class M2BDoc(FPDF):
    def header(self):
        # Thin top rule
        self.set_draw_color(*NAVY)
        self.set_line_width(0.6)
        self.line(18, 12, 192, 12)

        self.set_y(14)
        self.set_font("Helvetica", "B", 14)
        self.set_text_color(*NAVY)
        self.cell(0, 6, ascii(COMPANY), align="C", new_x="LMARGIN", new_y="NEXT")
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*MUTED)
        self.cell(0, 5, ascii(PILLARS), align="C", new_x="LMARGIN", new_y="NEXT")

        self.set_draw_color(*NAVY)
        self.set_line_width(0.35)
        self.line(18, self.get_y() + 2, 192, self.get_y() + 2)
        self.set_y(self.get_y() + 6)

    def footer(self):
        # Dual office block (same pattern as M2B proposals / agreements)
        self.set_y(-28)
        self.set_draw_color(*LINE)
        self.set_line_width(0.3)
        self.line(18, self.get_y(), 192, self.get_y())
        y = self.get_y() + 2

        self.set_xy(18, y)
        self.set_font("Helvetica", "B", 7)
        self.set_text_color(*NAVY)
        self.cell(85, 4, ascii("HARGEISA OFFICE"), new_x="LMARGIN", new_y="NEXT")
        self.set_x(18)
        self.set_font("Helvetica", "", 7)
        self.set_text_color(*MUTED)
        self.cell(85, 3.5, ascii("Hargeisa, Somaliland"), new_x="LMARGIN", new_y="NEXT")
        self.set_x(18)
        self.cell(85, 3.5, ascii("Tel: (252) 63-7744447"))

        self.set_xy(110, y)
        self.set_font("Helvetica", "B", 7)
        self.set_text_color(*NAVY)
        self.cell(82, 4, ascii("LONDON OFFICE"), new_x="RIGHT", new_y="TOP")
        self.set_xy(110, y + 4)
        self.set_font("Helvetica", "", 7)
        self.set_text_color(*MUTED)
        self.cell(82, 3.5, ascii("124-128 City Road, London, England"), new_x="RIGHT", new_y="TOP")
        self.set_xy(110, y + 7.5)
        self.cell(82, 3.5, ascii("EC1V 2NX"))

        self.set_y(-8)
        self.set_font("Helvetica", "", 7)
        self.set_text_color(*MUTED)
        self.cell(
            0,
            4,
            ascii(
                f"DentaFlow Client Demo Checklist  -  Page {self.page_no()}/{{nb}}"
            ),
            align="C",
        )


def meta_row(pdf: M2BDoc, label: str, value: str, x: float, w: float):
    pdf.set_xy(x, pdf.get_y())
    pdf.set_font("Helvetica", "B", 7)
    pdf.set_text_color(*MUTED)
    pdf.cell(w, 4, ascii(label), new_x="LMARGIN", new_y="NEXT")
    pdf.set_x(x)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*INK)
    pdf.cell(w, 5, ascii(value))


def section(pdf: M2BDoc, title: str):
    pdf.ln(4)
    y = pdf.get_y()
    if y > 240:
        pdf.add_page()
        y = pdf.get_y()
    pdf.set_fill_color(*SOFT)
    pdf.rect(18, y, 174, 8, "F")
    pdf.set_xy(20, y + 1.5)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*NAVY)
    pdf.cell(0, 5, ascii(title))
    pdf.set_y(y + 10)


def check(pdf: M2BDoc, text: str, note: str = ""):
    pdf.set_x(20)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*CHECK)
    pdf.cell(7, 5.5, "[ ]")
    pdf.set_text_color(*INK)
    pdf.set_font("Helvetica", "", 10)
    if note:
        pdf.cell(0, 5.5, ascii(text), new_x="LMARGIN", new_y="NEXT")
        pdf.set_x(27)
        pdf.set_font("Helvetica", "I", 8)
        pdf.set_text_color(*MUTED)
        pdf.multi_cell(163, 4, ascii(note))
        pdf.ln(0.5)
    else:
        pdf.multi_cell(163, 5.5, ascii(text))
        pdf.ln(0.3)


def body(pdf: M2BDoc, text: str):
    pdf.set_x(18)
    pdf.set_font("Helvetica", "", 9.5)
    pdf.set_text_color(*INK)
    pdf.multi_cell(174, 5, ascii(text))
    pdf.ln(1)


def main():
    pdf = M2BDoc(format="A4", unit="mm")
    pdf.set_auto_page_break(auto=True, margin=32)
    pdf.alias_nb_pages()
    pdf.add_page()

    # Document kind / title (agreement style)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(*MUTED)
    pdf.cell(0, 5, ascii(DOC_TITLE), align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "B", 16)
    pdf.set_text_color(*NAVY)
    pdf.cell(0, 8, ascii(DOC_KIND), align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)

    # Meta grid
    y0 = pdf.get_y()
    pdf.set_draw_color(*LINE)
    pdf.set_line_width(0.25)
    pdf.rect(18, y0, 174, 22)
    pdf.line(105, y0, 105, y0 + 22)
    pdf.line(18, y0 + 11, 192, y0 + 11)

    pdf.set_y(y0 + 1.5)
    meta_row(pdf, "CHECKLIST DATE", date.today().strftime("%d %B %Y"), 22, 78)
    pdf.set_y(y0 + 1.5)
    meta_row(pdf, "REFERENCE", REF, 109, 78)
    pdf.set_y(y0 + 12.5)
    meta_row(pdf, "PREPARED FOR", CLIENT, 22, 78)
    pdf.set_y(y0 + 12.5)
    meta_row(pdf, "PREPARED BY", PREPARED_BY, 109, 78)
    pdf.set_y(y0 + 26)

    body(
        pdf,
        "Use this sheet while presenting DentaFlow to N.I SMILE. Tick each item after "
        "the client has seen it working (or after you have agreed it is deferred). "
        "Currency throughout the app is USD. Staff screens are English only.",
    )

    section(pdf, "1. Access and shell")
    check(pdf, "Sign in with a demo or staff account")
    check(pdf, "Branch switcher works (single branch today; All branches for owner)")
    check(pdf, "Sidebar screens match role permissions")
    check(pdf, "Dark mode locked as the staff look and feel")

    section(pdf, "2. Catalog, stock, and purchasing")
    check(pdf, "Items and services with prices (retail / wholesale where relevant)")
    check(pdf, "Stock on hand by batch and expiry (FEFO)")
    check(pdf, "Transfers between branches (when more than one branch exists)")
    check(pdf, "Purchase orders and goods receipt into stock")
    check(pdf, "Low stock / expiry awareness on Stock or Reports")

    section(pdf, "3. Customers and appointments")
    check(pdf, "Retail and wholesale customers with phone and WhatsApp opt-in")
    check(pdf, "Wholesale credit limit and outstanding balance")
    check(pdf, "Book, confirm, reschedule, and cancel appointments")
    check(pdf, "Checkout in POS from an appointment (service + add-on products)")

    section(pdf, "4. Point of Sale and sales")
    check(pdf, "Retail and wholesale checkout in one transaction")
    check(pdf, "Tenders: Cash, Zaad, eDahab, MyCash (MyCash prints Pending until account set)")
    check(pdf, "VAT added at checkout (rate blank in Settings until clinic confirms)")
    check(pdf, "Promotion applied automatically when eligible")
    check(pdf, "Loyalty redeem / earn when rates are filled in Settings")
    check(pdf, "Thermal receipt / invoice documents from Sales history")
    check(pdf, "Wholesale pay-later (on account) with due date")

    section(pdf, "5. Expenses")
    check(pdf, "Record branch operating expense by category and tender")
    check(pdf, "Void an expense when needed")
    check(pdf, "Expenses appear on the Expenses and Profit & loss reports")

    section(pdf, "6. Promotions and WhatsApp")
    check(pdf, "Owner creates / publishes a promotion (English WhatsApp announcement)")
    check(pdf, "Campaign audience preview and enqueue")
    check(pdf, "WhatsApp templates edited in-app (name, body, Meta template name, status)")
    check(
        pdf,
        "Queue and Process due (Cloud API)",
        "While on Meta's test number, recipients must already be on Meta's allowlist. "
        "Production number removes that limit.",
    )
    check(pdf, "Inbound reply 1 / 2 and STOP opt-out path explained")

    section(pdf, "7. Reports")
    check(pdf, "Sales, profit, stock valuation, expiry, debts, VAT, promotions")
    check(pdf, "Balance Sheet (operational snapshot)")
    check(pdf, "Expenses and Profit & loss")
    check(pdf, "Custom from / to date range")
    check(pdf, "Print and Excel export")

    section(pdf, "8. Import and Settings")
    check(pdf, "Excel import for items, customers, or opening stock")
    check(pdf, "Owner Settings: clinic, branches, VAT / loyalty blanks called out")
    check(pdf, "Go-live checklist reviewed with the owner")

    section(pdf, "9. Open items for the clinic (not invented by M2B)")
    check(pdf, "Confirm VAT percentage")
    check(pdf, "Confirm loyalty earn and redeem rates")
    check(pdf, "Provide MyCash (Amal Bank) account number for documents")
    check(pdf, "Complete Meta Business verification and production WhatsApp number")
    check(pdf, "Submit / approve English WhatsApp templates (en_US) in Meta")

    section(pdf, "10. Sign-off")
    pdf.ln(2)
    pdf.set_font("Helvetica", "", 9.5)
    pdf.set_text_color(*INK)
    pdf.set_x(18)
    pdf.multi_cell(
        174,
        5,
        ascii(
            "Presented by: _______________________________     Date: _______________"
        ),
    )
    pdf.ln(3)
    pdf.set_x(18)
    pdf.multi_cell(
        174,
        5,
        ascii(
            "Client representative: _______________________     Date: _______________"
        ),
    )
    pdf.ln(3)
    pdf.set_x(18)
    pdf.multi_cell(
        174,
        5,
        ascii("Notes / deferred items:"),
    )
    pdf.set_draw_color(*LINE)
    y = pdf.get_y() + 2
    for _ in range(4):
        pdf.line(18, y, 192, y)
        y += 7

    pdf.output(str(OUT))
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
