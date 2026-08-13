/**
 * Billet imprimable.
 *
 * Genere avec pdf-lib, sans moteur de rendu HTML : le fichier reste leger et
 * la mise en page ne depend pas d'un navigateur installe sur le serveur.
 * Une page par billet, au format A5 paysage, lisible imprime comme a l'ecran.
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { formatDayLong, formatFcfa, formatTime } from "./utils";

export interface TicketPdfData {
  bookingReference: string;
  movieTitle: string;
  cinemaName: string;
  auditoriumName: string;
  startsAt: Date;
  format: string;
  language: string;
  tickets: {
    seatLabel: string;
    ticketTypeName: string;
    price: number;
    qrPayload: string;
  }[];
}

// A5 paysage, en points PostScript.
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 419.53;

const BRAND = rgb(0.969, 0.58, 0.118); // #F7941E
const INK = rgb(0.03, 0.03, 0.04);
const MUTED = rgb(0.42, 0.42, 0.47);

/**
 * Retire les caracteres que les polices standard PDF ne savent pas dessiner.
 * WinAnsi ne couvre pas tout, et un caractere absent fait echouer le rendu.
 */
function pdfSafe(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7E]/g, " ")
    .trim();
}

export async function buildTicketPdf(data: TicketPdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Billets Culture Parc ${data.bookingReference}`);
  pdf.setCreator("Culture Parc");

  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);

  for (const ticket of data.tickets) {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

    // Bandeau superieur aux couleurs de la marque.
    page.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - 64,
      width: PAGE_WIDTH,
      height: 64,
      color: INK,
    });

    page.drawCircle({
      x: 46,
      y: PAGE_HEIGHT - 32,
      size: 18,
      color: BRAND,
    });

    page.drawText("CP", {
      x: 36,
      y: PAGE_HEIGHT - 38,
      size: 14,
      font: bold,
      color: INK,
    });

    page.drawText("CULTURE PARC", {
      x: 76,
      y: PAGE_HEIGHT - 30,
      size: 17,
      font: bold,
      color: rgb(1, 1, 1),
    });

    page.drawText("Loisirs et divertissements", {
      x: 76,
      y: PAGE_HEIGHT - 46,
      size: 8,
      font: regular,
      color: rgb(0.7, 0.7, 0.75),
    });

    page.drawText(pdfSafe(`Commande ${data.bookingReference}`), {
      x: PAGE_WIDTH - 180,
      y: PAGE_HEIGHT - 38,
      size: 10,
      font: regular,
      color: rgb(0.85, 0.85, 0.9),
    });

    // Titre du film.
    let cursorY = PAGE_HEIGHT - 100;

    page.drawText(pdfSafe(data.movieTitle).slice(0, 42), {
      x: 40,
      y: cursorY,
      size: 24,
      font: bold,
      color: INK,
    });

    cursorY -= 26;

    page.drawText(
      pdfSafe(
        `${formatDayLong(data.startsAt)} a ${formatTime(data.startsAt)}  |  ${
          data.format === "THREE_D" ? "3D" : "2D"
        }  |  ${data.language}`,
      ),
      { x: 40, y: cursorY, size: 11, font: regular, color: MUTED },
    );

    // Informations principales, en colonnes.
    cursorY -= 46;

    const columns: { label: string; value: string; big?: boolean }[] = [
      { label: "PLACE", value: ticket.seatLabel, big: true },
      { label: "SALLE", value: data.auditoriumName },
      { label: "CINEMA", value: data.cinemaName },
      { label: "TARIF", value: `${ticket.ticketTypeName}` },
      { label: "PRIX", value: formatFcfa(ticket.price) },
    ];

    let columnX = 40;
    for (const column of columns) {
      page.drawText(column.label, {
        x: columnX,
        y: cursorY,
        size: 7.5,
        font: bold,
        color: MUTED,
      });

      page.drawText(pdfSafe(column.value).slice(0, 24), {
        x: columnX,
        y: cursorY - (column.big ? 26 : 18),
        size: column.big ? 26 : 12,
        font: bold,
        color: column.big ? BRAND : INK,
      });

      columnX += column.big ? 100 : 105;
    }

    // Code QR, a droite.
    const qrPng = await QRCode.toBuffer(ticket.qrPayload, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 400,
      color: { dark: "#000000", light: "#ffffff" },
    });

    const qrImage = await pdf.embedPng(qrPng);
    const qrSize = 132;

    page.drawImage(qrImage, {
      x: PAGE_WIDTH - qrSize - 40,
      y: 62,
      width: qrSize,
      height: qrSize,
    });

    page.drawText("Presentez ce code a l'entree", {
      x: PAGE_WIDTH - qrSize - 40,
      y: 48,
      size: 7.5,
      font: regular,
      color: MUTED,
    });

    // Pied de page.
    page.drawLine({
      start: { x: 40, y: 40 },
      end: { x: PAGE_WIDTH - 40, y: 40 },
      thickness: 0.5,
      color: rgb(0.85, 0.85, 0.88),
    });

    page.drawText(
      "Billet valable une seule fois. Un tarif reduit doit etre justifie a l'entree.",
      { x: 40, y: 26, size: 8, font: regular, color: MUTED },
    );
  }

  return pdf.save();
}
