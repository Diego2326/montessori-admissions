import { strToU8, zipSync } from "fflate";

export type WorkbookCell = string | number;

function xml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function columnName(index: number) {
  let value = index + 1;
  let name = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function worksheet(rows: WorkbookCell[][], hasDrawing = false) {
  const columns = Math.max(1, ...rows.map((row) => row.length));
  const widths = Array.from({ length: columns }, (_, index) => {
    const width = Math.min(54, Math.max(12, ...rows.map((row) => String(row[index] ?? "").length + 2)));
    return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
  }).join("");
  const content = rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, colIndex) => {
    const cell = `${columnName(colIndex)}${rowIndex + 1}`;
    const style = rowIndex === 0 ? ' s="1"' : "";
    if (typeof value === "number" && Number.isFinite(value)) return `<c r="${cell}"${style}><v>${value}</v></c>`;
    return `<c r="${cell}"${style} t="inlineStr"><is><t xml:space="preserve">${xml(String(value ?? ""))}</t></is></c>`;
  }).join("")}</row>`).join("");
  const filter = rows.length > 1 ? `<autoFilter ref="A1:${columnName(columns - 1)}${rows.length}"/>` : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${relationshipNs}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths}</cols><sheetData>${content}</sheetData>${filter}${hasDrawing ? '<drawing r:id="rId1"/>' : ""}</worksheet>`;
}

export type WorkbookChart = {
  type: "line" | "bar";
  title: string;
  categoryColumn: number;
  series: { nameColumn: number; valuesColumn: number; color: string }[];
  position: { fromColumn: number; fromRow: number; toColumn: number; toRow: number };
};
export type WorkbookSheet = { name: string; rows: WorkbookCell[][]; charts?: WorkbookChart[] };

const chartNs = "http://schemas.openxmlformats.org/drawingml/2006/chart";
const drawingNs = "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing";
const relationshipNs = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

function sheetRef(name: string) {
  return `'${name.replace(/'/g, "''")}'`;
}

function stringPoints(values: string[]) {
  return `<c:strCache><c:ptCount val="${values.length}"/>${values.map((value, index) => `<c:pt idx="${index}"><c:v>${xml(value)}</c:v></c:pt>`).join("")}</c:strCache>`;
}

function numberPoints(values: number[]) {
  return `<c:numCache><c:formatCode>0</c:formatCode><c:ptCount val="${values.length}"/>${values.map((value, index) => `<c:pt idx="${index}"><c:v>${Number.isFinite(value) ? value : 0}</c:v></c:pt>`).join("")}</c:numCache>`;
}

function chartXml(sheet: WorkbookSheet, chart: WorkbookChart, chartIndex: number) {
  const lastDataRow = sheet.rows.length;
  const categoryFormula = `${sheetRef(sheet.name)}!$${columnName(chart.categoryColumn)}$2:$${columnName(chart.categoryColumn)}$${lastDataRow}`;
  const categories = sheet.rows.slice(1).map((row) => String(row[chart.categoryColumn] ?? ""));
  const seriesXml = chart.series.map((series, index) => {
    const nameCell = `${sheetRef(sheet.name)}!$${columnName(series.nameColumn)}$1`;
    const valueFormula = `${sheetRef(sheet.name)}!$${columnName(series.valuesColumn)}$2:$${columnName(series.valuesColumn)}$${lastDataRow}`;
    const name = String(sheet.rows[0]?.[series.nameColumn] ?? "");
    const values = sheet.rows.slice(1).map((row) => typeof row[series.valuesColumn] === "number" ? row[series.valuesColumn] as number : Number(row[series.valuesColumn]) || 0);
    const prefix = `<c:idx val="${index}"/><c:order val="${index}"/><c:tx><c:strRef><c:f>${xml(nameCell)}</c:f>${stringPoints([name])}</c:strRef></c:tx>`;
    const dataRefs = `<c:cat><c:strRef><c:f>${xml(categoryFormula)}</c:f>${stringPoints(categories)}</c:strRef></c:cat><c:val><c:numRef><c:f>${xml(valueFormula)}</c:f>${numberPoints(values)}</c:numRef></c:val>`;
    if (chart.type === "line") return `<c:ser>${prefix}<c:spPr><a:ln w="28575"><a:solidFill><a:srgbClr val="${xml(series.color)}"/></a:solidFill><a:prstDash val="solid"/></a:ln></c:spPr><c:marker><c:symbol val="circle"/><c:size val="5"/><c:spPr><a:solidFill><a:srgbClr val="${xml(series.color)}"/></a:solidFill><a:ln><a:solidFill><a:srgbClr val="${xml(series.color)}"/></a:solidFill></a:ln></c:spPr></c:marker>${dataRefs}<c:smooth val="0"/></c:ser>`;
    return `<c:ser>${prefix}<c:spPr><a:solidFill><a:srgbClr val="${xml(series.color)}"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr>${dataRefs}</c:ser>`;
  }).join("");
  const axisBase = 100000 + chartIndex * 2;
  const plot = chart.type === "line"
    ? `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${seriesXml}<c:marker val="1"/><c:smooth val="0"/><c:axId val="${axisBase}"/><c:axId val="${axisBase + 1}"/></c:lineChart>`
    : `<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>${seriesXml}<c:gapWidth val="80"/><c:overlap val="0"/><c:axId val="${axisBase}"/><c:axId val="${axisBase + 1}"/></c:barChart>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><c:chartSpace xmlns:c="${chartNs}" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${relationshipNs}"><c:lang val="es-GT"/><c:chart><c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1300" b="1"/></a:pPr><a:r><a:rPr lang="es-GT"/><a:t>${xml(chart.title)}</a:t></a:r><a:endParaRPr lang="es-GT"/></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:plotArea><c:layout/>${plot}<c:catAx><c:axId val="${axisBase}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:tickLblPos val="nextTo"/><c:crossAx val="${axisBase + 1}"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/></c:catAx><c:valAx><c:axId val="${axisBase + 1}"/><c:scaling><c:orientation val="minMax"/><c:min val="0"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:majorGridlines><c:spPr><a:ln w="6350"><a:solidFill><a:srgbClr val="E6EBE8"/></a:solidFill></a:ln></c:spPr></c:majorGridlines><c:numFmt formatCode="0" sourceLinked="0"/><c:tickLblPos val="nextTo"/><c:crossAx val="${axisBase}"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx></c:plotArea><c:legend><c:legendPos val="b"/><c:layout/><c:overlay val="0"/></c:legend><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/><c:showDLblsOverMax val="0"/></c:chart><c:printSettings><c:headerFooter/><c:pageMargins l="0.25" r="0.25" t="0.5" b="0.5" header="0.3" footer="0.3"/><c:pageSetup/></c:printSettings></c:chartSpace>`;
}

function drawingXml(charts: WorkbookChart[]) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="${drawingNs}" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${relationshipNs}">${charts.map((chart, index) => `<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>${chart.position.fromColumn}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${chart.position.fromRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${chart.position.toColumn}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${chart.position.toRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${index + 2}" name="${xml(chart.title)}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="${chartNs}"><c:chart xmlns:c="${chartNs}" xmlns:r="${relationshipNs}" r:id="rId${index + 1}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`).join("")}</xdr:wsDr>`;
}

export function downloadWorkbookSheets(fileName: string, sheets: WorkbookSheet[]) {
  const safeSheets = sheets.map((sheet, index) => ({ ...sheet, name: (sheet.name.trim() || `Hoja ${index + 1}`).slice(0, 31) }));
  let chartCounter = 0;
  const chartParts: { sheetIndex: number; chart: WorkbookChart; chartIndex: number }[] = [];
  const sheetCharts = safeSheets.map((sheet, sheetIndex) => (sheet.charts ?? []).filter((chart) => sheet.rows.length > 1 && chart.series.length > 0).map((chart) => {
    chartCounter++;
    const part = { sheetIndex, chart, chartIndex: chartCounter };
    chartParts.push(part);
    return part;
  }));
  const overrides = [
    ...safeSheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`),
    ...safeSheets.flatMap((sheet, index) => (sheet.charts?.length && sheet.rows.length > 1) ? [`<Override PartName="/xl/drawings/drawing${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`] : []),
    ...chartParts.map((part) => `<Override PartName="/xl/charts/chart${part.chartIndex}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`),
  ].join("");
  const sheetEntries = safeSheets.map((sheet, index) => `<sheet name="${xml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("");
  const relationships = safeSheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("");
  const styleRelId = safeSheets.length + 1;
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${overrides}</Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetEntries}</sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships}<Relationship Id="rId${styleRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    "xl/styles.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F5947"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>`),
  };
  safeSheets.forEach((sheet, index) => {
    const charts = sheetCharts[index];
    files[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(worksheet(sheet.rows, charts.length > 0));
    if (!charts.length) return;
    files[`xl/worksheets/_rels/sheet${index + 1}.xml.rels`] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${relationshipNs}"><Relationship Id="rId1" Type="${relationshipNs}/drawing" Target="../drawings/drawing${index + 1}.xml"/></Relationships>`);
    files[`xl/drawings/drawing${index + 1}.xml`] = strToU8(drawingXml(charts.map((part) => part.chart)));
    files[`xl/drawings/_rels/drawing${index + 1}.xml.rels`] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${relationshipNs}">${charts.map((part, chartIndex) => `<Relationship Id="rId${chartIndex + 1}" Type="${relationshipNs}/chart" Target="../charts/chart${part.chartIndex}.xml"/>`).join("")}</Relationships>`);
  });
  chartParts.forEach((part) => {
    files[`xl/charts/chart${part.chartIndex}.xml`] = strToU8(chartXml(safeSheets[part.sheetIndex], part.chart, part.chartIndex));
  });
  const blob = new Blob([Uint8Array.from(zipSync(files, { level: 6 })).buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadWorkbook(fileName: string, sheetName: string, rows: WorkbookCell[][]) {
  downloadWorkbookSheets(fileName, [{ name: sheetName, rows }]);
}
