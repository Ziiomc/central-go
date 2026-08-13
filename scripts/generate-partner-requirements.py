from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "requisitos-socio-comercial-central-go.pdf"
PUBLIC = ROOT / "public" / "docs" / "requisitos-socio-comercial-central-go.pdf"
NAVY = colors.HexColor("#07111F")
CYAN = colors.HexColor("#31C3FF")
MUTED = colors.HexColor("#5D7285")
PALE = colors.HexColor("#EDF5FB")
GOLD = colors.HexColor("#F6C453")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="CGTitle", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=23, leading=27, textColor=NAVY, spaceAfter=10))
styles.add(ParagraphStyle(name="CGLead", parent=styles["BodyText"], fontSize=10.2, leading=15, textColor=MUTED, spaceAfter=10))
styles.add(ParagraphStyle(name="CGH", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=13, leading=16, textColor=NAVY, spaceBefore=8, spaceAfter=6))
styles.add(ParagraphStyle(name="CGB", parent=styles["BodyText"], fontSize=9.2, leading=13.5, textColor=NAVY, spaceAfter=5))
styles.add(ParagraphStyle(name="CGSmall", parent=styles["BodyText"], fontSize=7.8, leading=11, textColor=MUTED))
styles.add(ParagraphStyle(name="CGCenter", parent=styles["BodyText"], fontName="Helvetica-Bold", fontSize=10, leading=13, alignment=TA_CENTER, textColor=NAVY))


def footer(canvas, doc):
    w, h = A4
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.rect(0, h - 24 * mm, w, 24 * mm, fill=1, stroke=0)
    canvas.setFillColor(CYAN)
    canvas.circle(17 * mm, h - 12 * mm, 5.5 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 13)
    canvas.drawString(28 * mm, h - 11 * mm, "CENTRAL GO")
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(colors.HexColor("#B8CDDD"))
    canvas.drawString(28 * mm, h - 16 * mm, "Programa de Partners Comerciales")
    canvas.setStrokeColor(colors.HexColor("#D3DFE8"))
    canvas.line(16 * mm, 16 * mm, w - 16 * mm, 16 * mm)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7.2)
    canvas.drawString(16 * mm, 10 * mm, "Version 2.0 - 13 de agosto de 2026")
    canvas.drawRightString(w - 16 * mm, 10 * mm, f"Pagina {doc.page}")
    canvas.restoreState()


def bullet(text):
    return Paragraph(f"• {text}", styles["CGB"])


def build_story():
    story = [Spacer(1, 8 * mm)]
    story += [
        Paragraph("Requisitos y responsabilidades del Partner Comercial", styles["CGTitle"]),
        Paragraph("Documento informativo obligatorio para postular al programa comercial de Central GO. La postulacion no entrega acceso automatico: toda cuenta comercial debe ser revisada y aprobada por Superadmin.", styles["CGLead"]),
    ]
    summary = [
        [Paragraph("3 horas", styles["CGCenter"]), Paragraph("20%", styles["CGCenter"]), Paragraph("Soporte regional", styles["CGCenter"])],
        [Paragraph("Plazo minimo informado antes de revision.", styles["CGSmall"]), Paragraph("Comision comercial sobre ventas pagadas y confirmadas.", styles["CGSmall"]), Paragraph("Atencion y seguimiento de las centrales de su cartera.", styles["CGSmall"])],
    ]
    table = Table(summary, colWidths=[57 * mm] * 3, rowHeights=[9 * mm, 17 * mm])
    table.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), PALE), ("BOX", (0, 0), (-1, -1), .6, colors.HexColor("#C7D9E7")), ("INNERGRID", (0, 0), (-1, -1), .6, colors.HexColor("#C7D9E7")), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("ALIGN", (0, 0), (-1, -1), "CENTER")]))
    story += [table, Spacer(1, 5 * mm)]

    sections = [
        ("1. Naturaleza de la postulacion", [
            "El Partner Comercial representa comercialmente Central GO, capta centrales y las acompana durante su incorporacion y uso del servicio.",
            "La seleccion del rol crea solamente una postulacion pendiente.",
            "La aprobacion corresponde exclusivamente al Superadmin de Central GO.",
            "El postulante acepta mantener informacion comercial veraz y trazable.",
        ]),
        ("2. Responsabilidades", [
            "Prospectar y cerrar ventas sin promesas enganosas ni condiciones no autorizadas.",
            "Registrar correctamente cada central, oportunidad, plan y estado de pago.",
            "Dar atencion y soporte de primer nivel a las centrales de su cartera.",
            "Escalar incidentes tecnicos, de seguridad o de cobro que requieran intervencion de Central GO.",
            "Proteger datos personales, documentos y credenciales de clientes y conductores.",
        ]),
        ("3. Comision comercial del 20%", [
            "El Partner Comercial aprobado recibe el 20% sobre el valor efectivamente pagado y confirmado de las suscripciones atribuidas a su cartera.",
            "No existe comision por crear cuentas o registrar prospectos sin pago confirmado.",
            "Pagos rechazados, anulados, fraudulentos o reembolsados no generan comision disponible y pueden revertir una comision previamente registrada.",
            "La disponibilidad para liquidacion queda sujeta a la liberacion efectiva del dinero por el proveedor de pagos.",
        ]),
        ("4. Estructura regional", [
            "Un Partner Comercial puede pertenecer a un Partner Regional mediante un enlace de captacion o asignacion autorizada.",
            "El Partner Regional no recibe un porcentaje directo de la suscripcion. Su override se calcula sobre la comision del Partner Comercial.",
            "La configuracion regional vigente es 50% sobre la comision comercial. Con una venta de $100.000, el Partner Comercial genera $20.000 y el Regional genera $10.000.",
            "Antes de costos del procesador de pago, Central GO conserva $70.000 de ese ejemplo.",
        ]),
        ("5. Liquidaciones y reversos", [
            "Central GO registra cada pago, comision comercial, override regional, costo del proveedor y neto de plataforma por separado.",
            "Las comisiones pasan a disponibles solo cuando corresponde segun la fecha de liberacion del proveedor de pagos.",
            "Los reembolsos totales o parciales reducen o revierten proporcionalmente las comisiones relacionadas.",
            "Las transferencias a Partners requieren una cuenta de liquidacion verificada y un proveedor habilitado para pagos salientes.",
        ]),
        ("6. Conducta y seguridad", [
            "No solicitar contrasenas, codigos de verificacion, secretos OAuth ni claves bancarias de clientes.",
            "No descargar, vender o compartir bases de datos de Central GO.",
            "Informar de inmediato fraude, suplantacion o incidentes de seguridad.",
            "Cumplir la normativa tributaria, de consumo, publicidad y proteccion de datos aplicable.",
        ]),
    ]
    for title, items in sections:
        story.append(Paragraph(title, styles["CGH"]))
        for item in items:
            story.append(bullet(item))

    notice = Table([[Paragraph("<b>Declaracion del postulante</b><br/>Al aceptar, declaro que lei estas condiciones y comprendo que la comision comercial vigente es 20% sobre ventas pagadas y confirmadas. Si pertenezco a una estructura regional, el override del Regional se calcula sobre mi comision y no reduce el 20% que me corresponde.", styles["CGB"])]], colWidths=[171 * mm])
    notice.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFF8E6")), ("BOX", (0, 0), (-1, -1), .8, GOLD), ("LEFTPADDING", (0, 0), (-1, -1), 12), ("RIGHTPADDING", (0, 0), (-1, -1), 12), ("TOPPADDING", (0, 0), (-1, -1), 10), ("BOTTOMPADDING", (0, 0), (-1, -1), 10)]))
    story += [Spacer(1, 4 * mm), notice, Spacer(1, 6 * mm), Paragraph("Contacto oficial: ziiomc3@gmail.com", styles["CGB"]), Paragraph("Central GO puede actualizar estas condiciones. La version aceptada y su fecha quedan asociadas a la postulacion.", styles["CGSmall"])]
    return story


def generate():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(str(OUTPUT), pagesize=A4, rightMargin=18 * mm, leftMargin=18 * mm, topMargin=30 * mm, bottomMargin=22 * mm, title="Requisitos del Partner Comercial - Central GO", author="Central GO")
    doc.build(build_story(), onFirstPage=footer, onLaterPages=footer)
    PUBLIC.write_bytes(OUTPUT.read_bytes())


if __name__ == "__main__":
    generate()
