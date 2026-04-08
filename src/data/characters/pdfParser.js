import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorker from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

function normalizeFieldValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  return String(value).trim();
}

function normalizeFieldName(name) {
  return String(name || "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function parsePdf(file) {
  if (!file) return null;

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: arrayBuffer,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;

  let rawText = "";
  const fields = {};

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    rawText += content.items.map((item) => String(item?.str || "")).join(" ") + "\n";

    try {
      const annotations = await page.getAnnotations();
      for (const annotation of annotations) {
        const fieldName = normalizeFieldName(annotation?.fieldName || annotation?.alternativeText || annotation?.title);
        const fieldValue = normalizeFieldValue(
          annotation?.fieldValue ?? annotation?.buttonValue ?? annotation?.contents ?? ""
        );
        if (fieldName && !(fieldName in fields)) {
          fields[fieldName] = fieldValue;
        }
      }
    } catch (annotationError) {
      console.warn("[pdfParser] Failed to read annotations for page", pageNum, annotationError);
    }
  }

  return { rawText, fields };
}