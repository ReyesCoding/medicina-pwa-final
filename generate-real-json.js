import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// --- CONFIGURACIÓN DE RUTAS ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_FILE = path.join(__dirname, "sections.txt");
const OUTPUT_FILE = path.join(__dirname, "client/public/data/sections.json");
const COURSES_DB_PATH = path.join(__dirname, "client/public/data/courses.json");

// --- FUNCIONES DE UTILIDAD ---

function parseDays(text) {
  const days = [];
  let buffer = (text ?? "").toUpperCase();

  // Días compuestos primero
  if (buffer.includes("MA")) {
    days.push("Tuesday");
    buffer = buffer.replace("MA", "");
  }
  if (buffer.includes("MI")) {
    days.push("Wednesday");
    buffer = buffer.replace("MI", "");
  }

  // Días de una sola letra
  if (buffer.includes("L")) days.push("Monday");
  if (buffer.includes("J")) days.push("Thursday");
  if (buffer.includes("V")) days.push("Friday");
  if (buffer.includes("S")) days.push("Saturday");
  if (buffer.includes("D")) days.push("Sunday");

  return days;
}

function minutesToString(totalMinutes) {
  let minutesCalc = Number(totalMinutes) || 0;

  // Wrap 24h (por si cae al día siguiente)
  minutesCalc %= 1440;
  if (minutesCalc < 0) minutesCalc += 1440;

  const h = Math.floor(minutesCalc / 60);
  const m = Math.floor(minutesCalc % 60);

  const hStr = h < 10 ? "0" + h : "" + h;
  const mStr = m < 10 ? "0" + m : "" + m;

  return `${hStr}:${mStr}`;
}

function timeToMinutes(timeStr, isPM) {
  const safe = (timeStr ?? "").trim();
  const parts = safe.split(":");
  if (parts.length !== 2) return 0;

  let h = parseInt(parts[0], 10);
  let m = parseInt(parts[1], 10);
  if (Number.isNaN(h)) h = 0;
  if (Number.isNaN(m)) m = 0;

  // Lógica 12h
  if (h === 12) {
    h = isPM ? 12 : 0;
  } else if (isPM) {
    h += 12;
  }

  return h * 60 + m;
}

// --- EJECUCIÓN PRINCIPAL ---
try {
  console.log("--- INICIANDO GENERACIÓN DE JSON ---");

  // 1. CARGAR CURSOS (Para los créditos)
  if (!fs.existsSync(COURSES_DB_PATH)) {
    throw new Error("No se encontró el archivo courses.json");
  }

  const coursesRaw = fs.readFileSync(COURSES_DB_PATH, "utf-8");
  const coursesData = JSON.parse(coursesRaw);
  const coursesList = Array.isArray(coursesData)
    ? coursesData
    : (coursesData.courses || []);

  const creditsMap = new Map();
  for (const c of coursesList) {
    const id = c?.id ?? c?.courseId ?? c?.code; // fallback razonable
    const credits = Number(c?.credits ?? 0) || 0;
    if (id) creditsMap.set(id, credits);
  }
  console.log("✅ Créditos cargados.");

  // 2. LEER SECCIONES (TXT)
  if (!fs.existsSync(INPUT_FILE)) {
    throw new Error("No se encontró el archivo sections.txt");
  }
  const rawText = fs.readFileSync(INPUT_FILE, "utf-8");

  // Dividir por líneas (Windows/Linux)
  const allLines = rawText.split(/\r?\n/);

  // 3. LIMPIEZA Y UNIFICACIÓN DE LÍNEAS
  const cleanLines = [];
  let currentLine = "";

  // código tipo MED100001 (3-4 letras + 6 dígitos)
  const codeAnywherePattern = /\b[A-Z]{3,4}\d{6}\b/;
  const codeTokenPattern = /^[A-Z]{3,4}\d{6}\b/;

  for (const rawLine of allLines) {
    const line = (rawLine ?? "").replace(/\r/g, "").trim();
    if (!line) continue;

    // Si la línea contiene un código, la tratamos como inicio de nuevo registro
    if (codeAnywherePattern.test(line)) {
      if (currentLine) cleanLines.push(currentLine.trim());
      currentLine = line;
    } else {
      // Si todavía no tenemos un registro abierto, ignoramos “basura”/metadata
      if (!currentLine) continue;
      currentLine += " " + line;
    }
  }
  if (currentLine) cleanLines.push(currentLine.trim());

  // 4. PARSEAR LÍNEAS LIMPIAS
  const finalSections = [];

  for (const line of cleanLines) {
    // Intentar separar por tabs primero, si no por espacios dobles
    let parts;
    if (line.includes("\t")) {
      parts = line.split("\t");
    } else {
      parts = line.split(/  +/); // 2 o más espacios
    }
    parts = parts.map((p) => (p ?? "").trim()).filter(Boolean);

    // Buscar dónde está el código de materia (ej: MED100001)
    let claveIndex = -1;
    for (let i = 0; i < parts.length; i++) {
      if (codeTokenPattern.test(parts[i])) {
        claveIndex = i;
        break;
      }
    }
    if (claveIndex === -1) continue;

    const clave = parts[claveIndex].trim();
    const horarioRaw = parts[claveIndex + 2] ? parts[claveIndex + 2].trim() : "";
    const aulaRaw = parts[claveIndex + 3] ? parts[claveIndex + 3].trim() : "TBA";

    // Extraer ID y Sección: MED100001 -> MED, 100, 001
    const lettersMatch = clave.match(/^[A-Z]+/);
    const numbersMatch = clave.match(/\d+/);

    if (!lettersMatch || !numbersMatch) continue;

    const letters = lettersMatch[0];
    const numbers = numbersMatch[0];

    const courseNum = numbers.substring(0, 3);
    const sectionNum = numbers.substring(3);

    const courseId = `${letters}-${courseNum}`; // MED-100
    const credits = creditsMap.get(courseId) || 0;

    // --- LÓGICA DE HORARIO ---
    let schedule = [];

    const horarioLower = horarioRaw.toLowerCase();
    const aulaUpper = aulaRaw.toUpperCase();

    const isVirtual = horarioLower.includes("virtual") || aulaUpper.includes("VIRTU");
    const isHospital = horarioLower.includes("hosp");
    const isAsigVirtual = /asig\.?\s*virtual/i.test(horarioRaw);

    // Regex: Días + HoraInicio + (am/pm opcional)
    const timeMatch = horarioRaw.match(/([LMAIJVSD]+)\s*(\d{1,2}:\d{2}).*?(am|pm)?/i);

    if (isAsigVirtual || (isVirtual && !timeMatch)) {
      schedule = [{ day: "N/A", startTime: "Virtual", endTime: "Virtual" }];
    } else if (timeMatch) {
      const daysStr = timeMatch[1];
      const startTimeStr = timeMatch[2];
      const meridiem = timeMatch[3] ? timeMatch[3].toLowerCase() : null;

      const days = parseDays(daysStr);

      // Calcular inicio
      let isPM = false;
      if (meridiem) {
        isPM = meridiem === "pm";
      } else {
        // Heurística: 12 o 1..6 => PM
        const h = parseInt(startTimeStr.split(":")[0], 10);
        if (h === 12 || (h >= 1 && h <= 6)) isPM = true;
      }

      const startMinutes = timeToMinutes(startTimeStr, isPM);

      // Duración basada en créditos
      let duration = 90; // default
      if (credits > 0) {
        const weeklyMinutes = credits * 45;
        const daysCount = days.length > 0 ? days.length : 1;
        duration = Math.round(weeklyMinutes / daysCount);
      }

      const endMinutes = startMinutes + duration;
      const startStr = minutesToString(startMinutes);
      const endStr = minutesToString(endMinutes);

      for (const d of days) {
        schedule.push({ day: d, startTime: startStr, endTime: endStr });
      }
    } else if (isHospital) {
      schedule = [{ day: "Rotativo", startTime: "Hospital", endTime: "Practica" }];
    } else {
      // Sin info clara: dejamos TBA
      schedule = [{ day: "TBA", startTime: "TBA", endTime: "TBA" }];
    }

    finalSections.push({
      id: "sect-" + clave,
      courseId,
      sectionNumber: sectionNum,
      instructor: "Por Asignar",
      room: isVirtual ? "Virtual" : aulaRaw,
      crn: clave,
      schedule,
      maxCapacity: 30,
      currentEnrollment: 0,
    });
  }

  // 5. ESCRIBIR ARCHIVO
  console.log("💾 Escribiendo sections.json...");
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalSections, null, 2), "utf-8");

  console.log("✨ ¡ÉXITO! Archivo generado correctamente.");
} catch (error) {
  console.error("❌ Error:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
