from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "requisitos-socio-comercial-central-go.pdf"
PUBLIC = ROOT / "public" / "docs" / "requisitos-socio-comercial-central-go.pdf"

NAVY = colors.HexColor("#07111F")
BLUE = colors.HexColor("#078FE8")
CYAN = colors.HexColor("#31C3FF")
GOLD = colors.HexColor("#F6C453")
INK = colors.HexColor("#10263A")
MUTED = colors.HexColor("#5D7285")
PALE = colors.HexColor("#EDF5FB")
GREEN = colors.HexColor("#047857")


def register_fonts():
    regular = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
    bold = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")
    if regular.exists() and bold.exists():
        pdfmetrics.registerFont(TTFont("CentralSans", str(regular)))
        pdfmetrics.registerFont(TTFont("CentralSans-Bold", str(bold)))
        return "CentralSans", "CentralSans-Bold"
    return "Helvetica", "Helvetica-Bold"


REGULAR, BOLD = register_fonts()


def draw_header_footer(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setFillColor(NAVY)
    canvas.rect(0, height - 26 * mm, width, 26 * mm, fill=1, stroke=0)
    canvas.setFillColor(CYAN)
    canvas.circle(18 * mm, height - 13 * mm, 6 * mm, fill=1, stroke=0)
    canvas.setFillColor(NAVY)
    canvas.circle(18 * mm, height - 13 * mm, 2.4 * mm, fill=1, stroke=0)
    canvas.setFont(BOLD, 13)
    canvas.setFillColor(colors.white)
    canvas.drawString(29 * mm, height - 12 * mm, "CENTRAL GO")
    canvas.setFont(REGULAR, 7.8)
    canvas.setFillColor(colors.HexColor("#AFC5D8"))
    canvas.drawString(29 * mm, height - 17 * mm, "Programa de socios comerciales")
    canvas.setStrokeColor(colors.HexColor("#D3DFE8"))
    canvas.line(16 * mm, 17 * mm, width - 16 * mm, 17 * mm)
    canvas.setFont(REGULAR, 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(16 * mm, 11 * mm, "Version 1.0 - 13 de agosto de 2026")
    canvas.drawRightString(width - 16 * mm, 11 * mm, f"Pagina {doc.page}")
    canvas.restoreState()


styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="TitleCG", fontName=BOLD, fontSize=25, leading=29, textColor=NAVY, spaceAfter=8, alignment=TA_LEFT))
styles.add(ParagraphStyle(name="LeadCG", fontName=REGULAR, fontSize=10.5, leading=16, textColor=MUTED, spaceAfter=12))
styles.add(ParagraphStyle(name="HeadingCG", fontName=BOLD, fontSize=14, leading=18, textColor=NAVY, spaceBefore=8, spaceAfter=8))
styles.add(ParagraphStyle(name="SubheadingCG", fontName=BOLD, fontSize=10.5, leading=14, textColor=BLUE, spaceBefore=4, spaceAfter=4))
styles.add(ParagraphStyle(name="BodyCG", fontName=REGULAR, fontSize=9.2, leading=14, textColor=INK, spaceAfter=6))
styles.add(ParagraphStyle(name="BulletCG", fontName=REGULAR, fontSize=9, leading=13.5, textColor=INK, leftIndent=12, firstLineIndent=-7, bulletIndent=0, spaceAfter=4))
styles.add(ParagraphStyle(name="SmallCG", fontName=REGULAR, fontSize=7.8, leading=11, textColor=MUTED))
styles.add(ParagraphStyle(name="CalloutTitle", fontName=BOLD, fontSize=10.5, leading=14, textColor=NAVY, alignment=TA_CENTER))
styles.add(ParagraphStyle(name="CalloutBody", fontName=REGULAR, fontSize=8.2, leading=11.5, textColor=MUTED, alignment=TA_CENTER))


def bullet(text):
    return Paragraph(f"• {text}", styles["BulletCG"])


def section(title, body):
    return KeepTogether([Paragraph(title, styles["HeadingCG"]), *body])


def build_story():
    story = [Spacer(1, 10 * mm)]
    story.append(Paragraph("Requisitos y responsabilidades del socio comercial", styles["TitleCG"]))
    story.append(Paragraph(
        "Documento informativo obligatorio para quienes postulan al programa comercial de Central GO. "
        "Su lectura y aceptacion no otorgan acceso automatico: toda cuenta debe ser revisada y aprobada por el superadministrador.",
        styles["LeadCG"],
    ))

    summary = [
        [Paragraph("3 horas", styles["CalloutTitle"]), Paragraph("25%", styles["CalloutTitle"]), Paragraph("Soporte regional", styles["CalloutTitle"])],
        [Paragraph("Espera minima antes de que la aprobacion pueda realizarse.", styles["CalloutBody"]), Paragraph("Comision sobre inscripciones pagadas y confirmadas.", styles["CalloutBody"]), Paragraph("Atencion personalizada a cada central inscrita en su cartera.", styles["CalloutBody"])],
    ]
    table = Table(summary, colWidths=[57 * mm, 57 * mm, 57 * mm], rowHeights=[10 * mm, 18 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PALE),
        ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#C7D9E7")),
        ("INNERGRID", (0, 0), (-1, -1), 0.6, colors.HexColor("#C7D9E7")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
    ]))
    story.extend([table, Spacer(1, 6 * mm)])

    story.append(section("1. Naturaleza de la postulacion", [
        Paragraph("El socio comercial es una persona aprobada para representar comercialmente Central GO en una region definida, captar nuevas centrales y acompañarlas durante su incorporacion y uso del servicio.", styles["BodyCG"]),
        bullet("La seleccion del rol durante el registro crea solamente una postulacion pendiente."),
        bullet("La aprobacion corresponde exclusivamente al superadministrador de Central GO."),
        bullet("El sistema no permite aprobar antes de cumplirse una espera minima de 3 horas desde el envio."),
        bullet("Este documento es informativo. Las condiciones definitivas se complementan con el acuerdo comercial que corresponda."),
    ]))

    story.append(section("2. Requisitos minimos", [
        bullet("Ser mayor de edad y contar con capacidad legal para celebrar acuerdos comerciales en el pais de residencia."),
        bullet("Presentar identidad verificable, correo, telefono y domicilio o territorio comercial real."),
        bullet("Tener disponibilidad para atender consultas, realizar seguimiento y resolver incidencias de primer nivel."),
        bullet("Contar con habilidades de venta consultiva, comunicacion clara y manejo responsable de datos."),
        bullet("Emitir los documentos tributarios o comerciales exigidos por la legislacion aplicable cuando corresponda."),
        bullet("Aceptar las reglas de marca, privacidad, seguridad y registro de actividades de Central GO."),
    ]))

    story.append(section("3. Responsabilidades obligatorias", [
        Paragraph("La aprobacion implica asumir una cartera regional. La funcion no termina al cerrar la venta.", styles["BodyCG"]),
        Paragraph("Venta y cierre", styles["SubheadingCG"]),
        bullet("Prospectar centrales de taxi o radiotaxi, presentar Central GO con informacion verificable y cerrar ventas sin promesas engañosas."),
        bullet("Registrar correctamente cada oportunidad, responsable, territorio, plan elegido y estado del pago."),
        bullet("Acompañar la inscripcion inicial y confirmar que la central comprenda su prueba, plan y condiciones."),
        Paragraph("Atencion y soporte", styles["SubheadingCG"]),
        bullet("Dar atencion personalizada a todas las centrales inscritas por el socio dentro de su region o cartera."),
        bullet("Responder consultas operativas, orientar la configuracion inicial y realizar seguimiento de adopcion."),
        bullet("Resolver soporte de primer nivel y escalar oportunamente fallas tecnicas, pagos o incidentes que requieran intervencion central."),
        bullet("Mantener comunicacion respetuosa, trazable y dentro de tiempos razonables de servicio."),
    ]))

    story.append(section("4. Comision comercial del 25%", [
        Paragraph("El socio comercial aprobado recibe una comision del <b>25%</b> sobre el valor neto efectivamente pagado y confirmado de las inscripciones o activaciones de centrales que hayan sido correctamente atribuidas a su cartera.", styles["BodyCG"]),
        bullet("No existe comision por crear cuentas, reclutar postulantes o registrar datos sin una venta pagada."),
        bullet("Pagos rechazados, reembolsados, fraudulentos, duplicados o anulados no generan comision disponible."),
        bullet("La fecha y forma de liquidacion se determinan en el acuerdo comercial y en el estado contable de la plataforma."),
        bullet("El socio es responsable de sus obligaciones tributarias personales, salvo que la normativa aplicable establezca otra cosa."),
        Paragraph("La comision recurrente, si existiera en una oferta futura, debera constar expresamente por escrito. No se presume por este documento.", styles["SmallCG"]),
    ]))

    story.append(section("5. Conducta, privacidad y seguridad", [
        bullet("Usar los datos de contacto de centrales y conductores solo para finalidades autorizadas por Central GO."),
        bullet("No descargar, copiar, vender ni compartir bases de datos, documentos de identidad o credenciales."),
        bullet("No solicitar contraseñas, secretos OAuth, claves bancarias ni codigos de verificacion de clientes."),
        bullet("Informar de inmediato cualquier incidente de seguridad, suplantacion, fraude o uso indebido de la marca."),
        bullet("Respetar leyes locales de proteccion de datos, consumo, publicidad y comercio."),
    ]))

    workflow = [
        [Paragraph("1", styles["CalloutTitle"]), Paragraph("2", styles["CalloutTitle"]), Paragraph("3", styles["CalloutTitle"]), Paragraph("4", styles["CalloutTitle"])],
        [Paragraph("Postulacion", styles["CalloutBody"]), Paragraph("Espera minima", styles["CalloutBody"]), Paragraph("Revision humana", styles["CalloutBody"]), Paragraph("Aprobacion y acceso", styles["CalloutBody"])],
    ]
    flow_table = Table(workflow, colWidths=[43 * mm] * 4, rowHeights=[9 * mm, 13 * mm])
    flow_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F7FBFE")),
        ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#C7D9E7")),
        ("INNERGRID", (0, 0), (-1, -1), 0.6, colors.HexColor("#C7D9E7")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.extend([Paragraph("6. Flujo de aprobacion", styles["HeadingCG"]), flow_table, Spacer(1, 4 * mm)])
    story.append(Paragraph("Una vez aprobada la cuenta, Central GO crea el codigo comercial y habilita el panel correspondiente. Si la solicitud es rechazada, el postulante no obtiene acceso ni derechos de comision.", styles["BodyCG"]))

    notice = Table([[Paragraph(
        "<b>Declaracion del postulante</b><br/>Al marcar la casilla de aceptacion, declaro que lei este documento, que la informacion presentada es verdadera y que comprendo las obligaciones de venta, atencion y soporte regional. Tambien comprendo que el 25% se calcula solo sobre ventas pagadas y confirmadas.",
        ParagraphStyle("Notice", parent=styles["BodyCG"], textColor=NAVY, leading=14),
    )]], colWidths=[171 * mm])
    notice.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFF8E6")),
        ("BOX", (0, 0), (-1, -1), 0.8, GOLD),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.extend([Spacer(1, 4 * mm), notice, Spacer(1, 7 * mm)])
    story.append(Paragraph("Contacto y consultas", styles["HeadingCG"]))
    story.append(Paragraph("Correo oficial: <b>ziiomc3@gmail.com</b>", styles["BodyCG"]))
    story.append(Paragraph("Central GO puede actualizar este documento. La version aceptada queda registrada junto con la fecha y hora de la postulacion.", styles["SmallCG"]))
    return story


def generate():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC.parent.mkdir(parents=True, exist_ok=True)
    doc = BaseDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=32 * mm,
        bottomMargin=23 * mm,
        title="Requisitos del socio comercial - Central GO",
        author="Central GO",
        subject="Responsabilidades, aprobacion y comision del socio comercial",
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="content")
    doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=draw_header_footer)])
    doc.build(build_story())
    PUBLIC.write_bytes(OUTPUT.read_bytes())


if __name__ == "__main__":
    generate()

