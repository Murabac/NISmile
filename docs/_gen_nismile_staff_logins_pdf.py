"""
N.I SMILE staff login sheet — M2B TECH LTD formal letterhead
(same layout as MOCIT_DOMAIN_LIST.pdf: logo, gold rules, navy banner, dual offices).
Single page. No acknowledgement block.
"""
from datetime import date
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "M2B-NISMILE-Staff-Logins.pdf"
LOGO = ROOT / "assets" / "m2b-logo.png"

# Colors from MOCIT_DOMAIN_LIST.pdf
NAVY = (12, 37, 83)  # title banner / prepared-by name
BLUE = (21, 75, 140)  # table header
GOLD = (216, 168, 66)
PILLAR = (21, 75, 140)  # close to TECHNOLOGY line
ROW = (247, 248, 251)
LINE = (213, 220, 232)
MUTED = (90, 90, 90)
INK = (0, 0, 0)
WHITE = (255, 255, 255)
NUM = (34, 34, 58)

LEFT = 20  # ~56.7pt
RIGHT = 190  # ~539pt
WIDTH = RIGHT - LEFT

ACCOUNTS = [
    ("Owner", "owner@nismile.com", "owner123", "All branches"),
    (
        "Reception - Hargeisa",
        "reception.hargeisa@nismile.com",
        "receptionist123",
        "Hargeisa clinic",
    ),
    (
        "Reception - Jigjiga",
        "reception.jigjiga@nismile.com",
        "receptionist123",
        "Jigjiga branch",
    ),
    (
        "Wholesale + Stock",
        "wholesale@nismile.com",
        "wholesale123",
        "Wholesale, Hargeisa, Jigjiga",
    ),
]


def ascii(text: str) -> str:
    return (
        text.replace("\u2014", "-")
        .replace("\u2013", "-")
        .replace("\u2018", "'")
        .replace("\u2019", "'")
        .replace("\u2022", "-")
        .replace("·", "-")
        .replace("—", "-")
        .replace("–", "-")
    )


class M2BDoc(FPDF):
    def header(self):
        # Logo left, company name right (MOCIT layout)
        if LOGO.exists():
            self.image(str(LOGO), x=LEFT + 2.5, y=14, w=17.5)

        self.set_xy(LEFT, 16.5)
        self.set_font("Helvetica", "B", 15)
        self.set_text_color(*NAVY)
        self.cell(WIDTH, 7, ascii("M2B TECH LTD"), align="R", new_x="LMARGIN", new_y="NEXT")
        self.set_x(LEFT)
        self.set_font("Helvetica", "", 7.5)
        self.set_text_color(*PILLAR)
        self.cell(
            WIDTH,
            5,
            ascii("TECHNOLOGY  |  INNOVATION  |  SOLUTIONS"),
            align="R",
        )

        # Gold rule under header
        self.set_draw_color(*GOLD)
        self.set_line_width(0.7)
        self.line(LEFT, 35, RIGHT, 35)
        self.set_y(40)

    def footer(self):
        # Gold rule above offices
        self.set_draw_color(*GOLD)
        self.set_line_width(0.7)
        self.line(LEFT, 268, RIGHT, 268)

        y = 272
        self.set_xy(LEFT + 2, y)
        self.set_font("Helvetica", "B", 7.5)
        self.set_text_color(*NAVY)
        self.cell(80, 4, ascii("HARGEISA OFFICE"), new_x="LMARGIN", new_y="NEXT")
        self.set_x(LEFT + 2)
        self.set_font("Helvetica", "", 7.5)
        self.set_text_color(*MUTED)
        self.cell(80, 3.5, ascii("Hargeisa, Somaliland"), new_x="LMARGIN", new_y="NEXT")
        self.set_x(LEFT + 2)
        self.cell(80, 3.5, ascii("Tel: (252) 63-7744447"))

        self.set_xy(LEFT + 95, y)
        self.set_font("Helvetica", "B", 7.5)
        self.set_text_color(*NAVY)
        self.cell(75, 4, ascii("LONDON OFFICE"), align="R", new_x="RIGHT", new_y="TOP")
        self.set_xy(LEFT + 95, y + 4)
        self.set_font("Helvetica", "", 7.5)
        self.set_text_color(*MUTED)
        self.cell(75, 3.5, ascii("124-128 City Road, London, England"), align="R")
        self.set_xy(LEFT + 95, y + 7.5)
        self.cell(75, 3.5, ascii("EC1V 2NX"), align="R")

        self.set_y(288)
        self.set_font("Helvetica", "", 7.5)
        self.set_text_color(*MUTED)
        self.cell(
            0,
            4,
            ascii("DentaFlow Staff App  -  Staff Login Credentials  -  Page 1 of 1"),
            align="C",
        )


def main():
    if not LOGO.exists():
        raise SystemExit(f"Missing logo at {LOGO}")

    pdf = M2BDoc(format="A4", unit="mm")
    pdf.set_auto_page_break(auto=False)
    pdf.add_page()

    # Navy title banner
    pdf.set_fill_color(*NAVY)
    pdf.rect(LEFT, 40.5, WIDTH, 19, "F")
    # Gold underline under banner
    pdf.set_draw_color(*GOLD)
    pdf.set_line_width(1.0)
    pdf.line(LEFT, 59.5, RIGHT, 59.5)

    pdf.set_xy(LEFT, 43)
    pdf.set_font("Helvetica", "B", 16)
    pdf.set_text_color(*WHITE)
    pdf.cell(WIDTH, 7, ascii("N.I SMILE STAFF LOGIN"), align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_x(LEFT)
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_text_color(*GOLD)
    pdf.cell(WIDTH, 6, ascii("CREDENTIALS"), align="C")

    # Table
    table_top = 72
    col_role = 42
    col_email = 62
    col_pass = 36
    col_access = WIDTH - col_role - col_email - col_pass
    row_h = 10.5
    header_h = 7

    # Header row
    pdf.set_fill_color(*BLUE)
    pdf.rect(LEFT, table_top, WIDTH, header_h, "F")
    pdf.set_text_color(*WHITE)
    pdf.set_font("Helvetica", "B", 8)
    x = LEFT
    for w, label in (
        (col_role, "ROLE"),
        (col_email, "EMAIL"),
        (col_pass, "PASSWORD"),
        (col_access, "BRANCH ACCESS"),
    ):
        pdf.set_xy(x + 1.5, table_top + 1.5)
        pdf.cell(w - 2, 4, ascii(label))
        x += w

    y = table_top + header_h
    for i, (role, email, password, access) in enumerate(ACCOUNTS):
        if i % 2 == 1:
            pdf.set_fill_color(*ROW)
            pdf.rect(LEFT, y, WIDTH, row_h, "F")
        pdf.set_draw_color(*LINE)
        pdf.set_line_width(0.3)
        pdf.line(LEFT, y, RIGHT, y)

        pdf.set_xy(LEFT + 1.5, y + 2.8)
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(*NUM)
        pdf.cell(col_role - 2, 5, ascii(role))

        pdf.set_xy(LEFT + col_role + 1.5, y + 2.8)
        pdf.set_font("Helvetica", "", 8.5)
        pdf.set_text_color(*INK)
        pdf.cell(col_email - 2, 5, ascii(email))

        pdf.set_xy(LEFT + col_role + col_email + 1.5, y + 2.8)
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(*INK)
        pdf.cell(col_pass - 2, 5, ascii(password))

        pdf.set_xy(LEFT + col_role + col_email + col_pass + 1.5, y + 2.8)
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(*INK)
        pdf.cell(col_access - 2, 5, ascii(access))

        y += row_h

    pdf.set_draw_color(*LINE)
    pdf.line(LEFT, y, RIGHT, y)

    # Navy footer strip on table
    pdf.set_fill_color(*NAVY)
    pdf.rect(LEFT, y, WIDTH, 8, "F")
    pdf.set_xy(LEFT, y + 1.8)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(*WHITE)
    pdf.cell(WIDTH, 4.5, ascii("CONFIDENTIAL - KEEP WITH THE OWNER"), align="C")

    # Prepared by (same position family as MOCIT)
    pdf.set_xy(LEFT, 248)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(*PILLAR)
    pdf.cell(0, 4, ascii("PREPARED BY"), new_x="LMARGIN", new_y="NEXT")
    pdf.set_x(LEFT)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(*NAVY)
    pdf.cell(0, 5, ascii("M2B TECH LTD"), new_x="LMARGIN", new_y="NEXT")
    pdf.set_x(LEFT)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*NUM)
    pdf.cell(0, 5, ascii(date.today().strftime("%d %B %Y")))

    pdf.output(str(OUT))
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
