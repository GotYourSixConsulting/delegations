/* global React, ReactDOM */

const { useState, useEffect, useMemo, useCallback, useRef } = React;


/**
 * DelegationManagementApp.jsx
 * Prototype: Oregon RN Delegation (Division 47) tracker for Assisted Living / Memory Care
 */

// -------------------- HELPERS --------------------
const todayISO = () => new Date().toISOString().split("T")[0];

const addDays = (dateISO, days) => {
  const d = new Date(dateISO);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
};

const daysBetween = (startISO, endISO) =>
  Math.floor((new Date(endISO) - new Date(startISO)) / (1000 * 60 * 60 * 24));

const formatDate = (dateISO) =>
  dateISO
    ? new Date(dateISO).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

const uid = (prefix = "id") =>
  `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`;

const escapeHtml = (s) =>
  (s ?? "")
    .toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const clampNumber = (n, min, max) => Math.max(min, Math.min(max, n));

const composeDelegationJustificationText = ({
  rnName,
  authDays,
  stablePredictable,
  fields,
}) => {
  const f = fields || {};
  const rn = rnName || "__________";
  const days = Number.isFinite(authDays) ? authDays : "";
  const stableLine = stablePredictable
    ? "stable and predictable"
    : "NOT confirmed as stable and predictable";

  return [
    `Length of time RN has worked with employee being delegated: ${f.rnWorkedWithEmployeeLength || "—"}`,
    `Document method of training/delegating task of administering insulin, including rationale: ${f.trainingMethodAndRationale || "—"}`,
    `Length of time during career employee has given insulin; include details on within your community and total within career.`,
    `• Within this community: ${f.insulinExperienceCommunity || "—"}`,
    `• Total within career: ${f.insulinExperienceCareer || "—"}`,
    `Length of time the employee has worked directly with the Resident being delegated and knowledge level of individualized signs and symptoms of hyper/hypoglycemia of this resident: ${
      f.residentWorkAndKnowledge || "—"
    }`,
    `Describe the willingness of the Unlicensed Professional to conduct the delegated task: ${f.willingnessDescription || "—"}`,
    `I, ${rn}, RN am delegating this employee for the next (${days}) days based on the above criteria and documented assessment in the medical record of the resident being ${stableLine}.`,
  ].join("\n");
};

// -------------------- CONFIG --------------------
const DEFAULT_AUTH_DAYS = 90;
const MAX_AUTH_DAYS = 180;
const INITIAL_REEVAL_DUE_DAYS = 60;
const DUE_SOON_DAYS = 14;
const ASSESSMENT_INTERVAL_DAYS = 90;

// -------------------- TASK TEMPLATES --------------------
const DELEGATION_TASKS = [
  {
    id: "insulin-pen",
    label: "Insulin Administration (Pen)",
    formTemplate: "RN Delegation Insulin Pen.docx",
  },
  {
    id: "insulin-vial",
    label: "Insulin Administration (Vial/Syringe)",
    formTemplate: "RN Delegation Insulin Vial.docx",
  },
  {
    id: "trulicity",
    label: "Trulicity Administration",
    formTemplate: "RN Delegation Instructions Trulicity.docx",
  },
  {
    id: "libre-sensor",
    label: "Libre Sensor Removal/Application",
    formTemplate: "RN Delegation Instructions Libre Sensor.docx",
  },
  {
    id: "glucose-monitoring",
    label: "Blood Glucose Measurement",
    formTemplate: "RN Delegation Glucose Monitoring.docx",
  },
  {
    id: "glp-1",
    label: "GLP-1 Agonists Administration",
    formTemplate: "RN Delegation of GLP-1.docx",
  },
];

const DIABETIC_TRAINING_CONTENT = `Medication Technician – Diabetic Training

What is diabetes?
Diabetes is the condition in which the body does not properly process food for use as energy. The pancreas makes insulin to help glucose get into cells. In diabetes, the body doesn't make enough insulin or can't use it well, causing sugar buildup in blood.

What is Hypoglycemia? Not enough sugar in the blood. Blood sugar below 70.
Symptoms: Cold clammy skin, excessive perspiration, headache, confusion, slurred speech, weakness, drowsiness, nervousness, fatigue, trembling, hunger, impaired vision, rapid heart rate.

3. Rule of Fifteens (Low Blood Sugar < 70)
- If unresponsive/unable to swallow: Call 911.
- If responsive:
  1. Eat/drink 15g Carbohydrates (e.g., 4-6oz orange juice, 4-6oz regular soda, 2-4 glucose tabs).
  2. Re-test in 15 min.
  3. If still < 70, repeat 15g carbs and re-test in 15 min.
  4. If still < 70, notify RN/PCP immediately.
  5. If > 70, follow with protein snack (milk, cheese, peanut butter).

What is Hyperglycemia? Too much sugar in the blood. Blood sugar above 200.
Symptoms: Increased thirst, increased urination, weakness, hunger, nausea, blurry vision, drowsiness, sweet/alcohol smell on breath.
Action: Follow hyperglycemia protocol.

Injection Safety (Insulin Pen)
- Triple check MAR and Pen label.
- Roll cloudy insulin (never shake).
- Prime needle with 2 units (point up).
- Hold pen in skin for 10 seconds after injection.
- Dispose of needle in sharps container immediately. Never recap if possible.`;

const TASK_PACKET_SNIPPETS = {
  "insulin-pen": {
    title: "Insulin Administration (Pen)",
    steps: [
      "Verify resident identity, medication, dose, timing, and parameters.",
      "Perform/confirm blood glucose per ordered parameters (if applicable).",
      "Prepare pen/needle per policy; choose site; cleanse skin.",
      "Administer subcutaneous injection; dispose sharps per protocol.",
      "Document administration and any resident response/concerns.",
    ],
    watchFor: [
      "Hypoglycemia symptoms",
      "Injection site bleeding/bruising",
      "Unusual resident change",
    ],
    actionIfOccurs: [
      "Follow hypoglycemia protocol; notify RN; call 911 if unresponsive",
      "Notify RN; apply pressure if bleeding",
    ],
  },
  "insulin-vial": {
    title: "Insulin Administration (Vial/Syringe)",
    steps: [
      "Verify resident identity, medication, dose, timing, and parameters.",
      "Perform/confirm blood glucose per ordered parameters (if applicable).",
      "Cleanse vial top; inject air; draw up correct dose; verify no bubbles.",
      "Prepare site; cleanse skin; administer subcutaneous injection.",
      "Dispose sharps immediately; document administration.",
    ],
    watchFor: [
      "Hypoglycemia symptoms",
      "Injection site bleeding/bruising",
      "Incorrect dose measurement",
    ],
    actionIfOccurs: [
      "Follow hypoglycemia protocol; notify RN; call 911 if unresponsive",
    ],
  },
  "glucose-monitoring": {
    title: "Blood Glucose Measurement",
    steps: [
      "Verify resident identity and order parameters.",
      "Perform fingerstick per device policy and infection control.",
      "Record reading and act per parameter thresholds.",
      "Notify RN/MD as ordered; document notifications.",
    ],
    watchFor: ["Low BG symptoms", "High BG symptoms", "Bleeding at puncture site"],
    actionIfOccurs: [
      "Follow hypo/hyperglycemia protocol; notify RN; call 911 if needed",
    ],
  },
  "libre-sensor": {
    title: "Libre Sensor Removal/Application",
    steps: [
      "Verify correct resident and device.",
      "Apply/remove per manufacturer + RN instruction.",
      "Ensure adhesion; monitor for bleeding/skin irritation.",
      "Document device application/removal and any issues.",
    ],
    watchFor: [
      "Bleeding",
      "Infection signs at site",
      "Device not adhering/incorrect readings",
    ],
    actionIfOccurs: ["Notify RN immediately; obtain manual BG if needed"],
  },
  "trulicity": {
    title: "Trulicity Administration",
    steps: [
      "Verify resident identity and order.",
      "Prepare injection; administer per policy.",
      "Monitor for injection site bleeding/bruising and common side effects.",
      "Document administration and resident response.",
    ],
    watchFor: ["Bleeding/bruising", "GI side effects", "Hypoglycemia (if applicable)"],
    actionIfOccurs: [
      "Notify RN; follow protocol; call 911 if severe/unresponsive",
    ],
  },
  "glp-1": {
    title: "GLP-1 Agonists Administration",
    steps: [
      "Verify order and resident",
      "Prepare/administration per product",
      "Document and monitor response",
    ],
    watchFor: ["GI side effects", "Injection site reaction"],
    actionIfOccurs: ["Notify RN; follow policy"],
  },
};

// -------------------- MOCK DATA --------------------
const MOCK_COMMUNITIES = [
  {
    id: "cm-01",
    name: "The Cottages Memory Care",
    admin: { name: "", email: "", phone: "" },
    rn: { name: "", email: "", phone: "" },
    notifications: { regionalOps: "", regionalNurse: "" },
  },
  {
    id: "cm-02",
    name: "Powell Valley Assisted Living",
    admin: { name: "", email: "", phone: "" },
    rn: { name: "", email: "", phone: "" },
    notifications: { regionalOps: "", regionalNurse: "" },
  },
  {
    id: "cm-03",
    name: "Powell Valley Memory Care",
    admin: { name: "", email: "", phone: "" },
    rn: { name: "", email: "", phone: "" },
    notifications: { regionalOps: "", regionalNurse: "" },
  },
  {
    id: "cm-04",
    name: "Woodside Assisted Living",
    admin: { name: "", email: "", phone: "" },
    rn: { name: "", email: "", phone: "" },
    notifications: { regionalOps: "", regionalNurse: "" },
  },
  {
    id: "cm-05",
    name: "Evergreen Assisted Living",
    admin: { name: "", email: "", phone: "" },
    rn: { name: "", email: "", phone: "" },
    notifications: { regionalOps: "", regionalNurse: "" },
  },
  {
    id: "cm-06",
    name: "Evergreen Memory Care",
    admin: { name: "", email: "", phone: "" },
    rn: { name: "", email: "", phone: "" },
    notifications: { regionalOps: "", regionalNurse: "" },
  },
];

const MOCK_RESIDENTS = [
  {
    id: "res-001",
    communityId: "cm-01",
    name: "Donald Duck",
    dob: "1934-06-09",
    unit: "101",
    diagnosis: "Type 2 Diabetes, brittle insulin-dependent",
    regimen: "Novolog FlexPen sliding scale 3x daily after meals, Lantus 20 units AM",
    assessmentStatus: "Stable",
    lastAssessmentDate: "2024-11-09",
    reassessInDays: 90,
    assessments: [
      {
        date: "2024-11-09",
        type: "Quarterly",
        notes: "Stable and predictable. Hypoglycemic events: >3 in 30 days.",
        stable: true,
      },
    ],
  },
  {
    id: "res-002",
    communityId: "cm-02",
    name: "Bonnie Link",
    dob: "1948-01-15",
    unit: "204",
    diagnosis: "Type 2 Diabetes with neuropathy",
    regimen: "Metformin 1000mg BID, Novolog 10 units QID after meals/HS",
    assessmentStatus: "Stable",
    lastAssessmentDate: "2024-10-20",
    reassessInDays: 90,
    assessments: [
      {
        date: "2024-10-20",
        type: "Initial",
        notes: "At risk for falls with hypoglycemia.",
        stable: true,
      },
    ],
  },
  {
    id: "res-003",
    communityId: "cm-01",
    name: "Jacen Johns",
    dob: "1955-08-22",
    unit: "305",
    diagnosis: "Type 2 Diabetes, Hyperlipidemia",
    regimen: "Trulicity 1.5mg weekly, Lantus 20 units HS, Humalog sliding scale AC/HS",
    assessmentStatus: "Stable",
    lastAssessmentDate: "2024-08-15",
    reassessInDays: 90,
    assessments: [
      {
        date: "2024-08-15",
        type: "Initial",
        notes: "Needs reminders for weekly injection.",
        stable: true,
      },
    ],
  },
];

const MOCK_MEDTECHS = [
  {
    id: "mt-001",
    communityId: "cm-01",
    name: "Kevin Mills",
    hireDate: "2019-01-01",
    experience: "5 years as Med-Tech, giving insulin entire career.",
    training: "Completed diabetic training",
    competencyDates: { demonstrated: "2024-10-20", redemonstrated: "2024-10-20" },
    willingness: true,
    lastSupervision: "2024-11-01",
    trainingTranscript: [
      {
        date: "2019-01-10",
        topic: "Initial Diabetic Training",
        notes: "4 hour course completed.",
      },
      {
        date: "2024-10-20",
        topic: "Insulin Pen Competency",
        notes: "Demonstrated skills successfully.",
      },
    ],
    delegationProfile: {
      rnWorkedWithEmployeeLength: "RN has worked with employee for 5 years (multiple direct observations).",
      insulinExperienceCommunity: "5 years within this community administering insulin per MAR.",
      insulinExperienceCareer: "5+ years total administering insulin across prior roles.",
      willingnessDescription: "Willing and routinely performs task; asks questions appropriately and reports concerns.",
    },
  },
  {
    id: "mt-002",
    communityId: "cm-01",
    name: "Alicia Perez",
    hireDate: "2024-02-10",
    experience: "New to insulin",
    training: "Needs insulin training",
    competencyDates: { demonstrated: "", redemonstrated: "" },
    willingness: false,
    lastSupervision: "",
    trainingTranscript: [],
    delegationProfile: {
      rnWorkedWithEmployeeLength: "",
      insulinExperienceCommunity: "",
      insulinExperienceCareer: "",
      willingnessDescription: "",
    },
  },
];

// -------------------- UI PRIMITIVES --------------------
const Badge = ({ children, tone = "gray" }) => {
  const tones = {
    gray: "bg-gray-100 text-gray-700",
    green: "bg-green-50 text-green-700",
    yellow: "bg-yellow-50 text-yellow-800",
    red: "bg-red-50 text-red-700",
    indigo: "bg-indigo-50 text-indigo-700",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-1 text-xs rounded-md border ${tones[tone]}`}
    >
      {children}
    </span>
  );
};

const Card = ({ title, value, icon, hint, tone = "indigo", onClick }) => {
  const toneMap = {
    indigo: "bg-gray-200",
    red: "bg-red-100",
    yellow: "bg-gray-200",
    green: "bg-gray-200",
    gray: "bg-gray-200",
  };
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl shadow-sm border p-4 transition-all ${toneMap[tone]} ${
        onClick ? "cursor-pointer hover:shadow-md hover:brightness-95" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-gray-600">{title}</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{value}</div>
          {hint ? <div className="text-xs text-gray-500 mt-1">{hint}</div> : null}
        </div>
        <div className="p-2 rounded-xl bg-white border border-gray-200">
          {icon}
        </div>
      </div>
    </div>
  );
};

const Button = ({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  className = "",
  title,
}) => {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold border shadow-sm transition active:scale-[0.99]";
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700",
    secondary:
      "bg-white text-gray-800 border-gray-200 hover:bg-gray-50",
    danger: "bg-white text-red-700 border-red-200 hover:bg-red-50",
    ghost: "bg-transparent text-gray-700 hover:bg-gray-100",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${base} ${variants[variant]} ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      } ${className}`}
    >
      {children}
    </button>
  );
};

const NavButton = ({ id, label, icon, currentView, onClick }) => (
  <button
    onClick={() => onClick(id)}
    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold transition ${
      currentView === id
        ? "bg-white text-indigo-700 border-white"
        : "bg-indigo-700/20 text-white border-transparent hover:bg-indigo-700/30"
    }`}
  >
    {icon}
    {label}
  </button>
);

const Label = ({ children }) => (
  <div className="text-sm font-semibold text-gray-800 mb-1">{children}</div>
);

const Checkbox = ({ label, checked, onChange }) => (
  <label className="flex items-start gap-2 p-2 rounded-xl hover:bg-gray-50 cursor-pointer">
    <input
      type="checkbox"
      className="mt-1 h-4 w-4"
      checked={!!checked}
      onChange={(e) => onChange(e.target.checked)}
    />
    <span className="text-sm text-gray-800">{label}</span>
  </label>
);

const Modal = ({ title, open, onClose, children, footer }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div className="text-xl font-bold text-gray-900">{title}</div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>
        <div className="p-5 overflow-auto flex-1">{children}</div>
        {footer ? (
          <div className="px-5 py-4 border-t bg-gray-50 shrink-0">{footer}</div>
        ) : null}
      </div>
    </div>
  );
};

// -------------------- SIGNATURE PAD --------------------
function SignaturePad({ value, onChange }) {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    if (!value) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = value;
  }, [value]);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const start = (e) => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(getPos(e).x, getPos(e).y);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111827";
    setDrawing(true);
  };
  const move = (e) => {
    if (!drawing) return;
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const end = () => {
    if (!drawing) return;
    setDrawing(false);
    onChange(canvasRef.current.toDataURL("image/png"));
  };
  const clear = () => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    onChange("");
  };

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          width={900}
          height={180}
          className="w-full h-[140px]"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
        />
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={clear}>
          Clear
        </Button>
        <Badge tone={value ? "green" : "gray"}>
          {value ? "Signature captured" : "Draw signature (optional)"}
        </Badge>
      </div>
    </div>
  );
}

// -------------------- PRINT HELPERS --------------------
function buildPacketHTML({
  orgName,
  orgRNName,
  delegation,
  resident,
  medTech,
  task,
  packet,
  rnSig,
  mtSig,
}) {
  const safe = escapeHtml;
  const checklist = delegation?.checklist || {};
  const competency = delegation?.competencyMethods || {};
  const j = delegation?.justification || {};
  const mtProfile = medTech?.delegationProfile || {};
  const mtWillingFallback =
    mtProfile.willingnessDescription ||
    (medTech?.willingness === true
      ? "Willing"
      : medTech?.willingness === false
      ? "Not willing"
      : "");

  const resolved = {
    rnWorkedWithEmployeeLength:
      j.rnWorkedWithEmployeeLength || mtProfile.rnWorkedWithEmployeeLength || "",
    trainingMethodAndRationale: j.trainingMethodAndRationale || "",
    insulinExperienceCommunity:
      j.insulinExperienceCommunity || mtProfile.insulinExperienceCommunity || "",
    insulinExperienceCareer:
      j.insulinExperienceCareer || mtProfile.insulinExperienceCareer || "",
    residentWorkAndKnowledge: j.residentWorkAndKnowledge || "",
    willingnessDescription:
      j.willingnessDescription || mtWillingFallback || "",
  };

  const authDays =
    Number.isFinite(delegation?.authDays) && delegation.authDays > 0
      ? delegation.authDays
      : Math.max(0, daysBetween(delegation?.startDate, delegation?.endDate));

  const rnNameForStatement =
    rnSig?.typedName || delegation?.delegatingRNName || orgRNName || "";

  const sigImg = (dataUrl) =>
    dataUrl
      ? `<img src="${dataUrl}" style="height:50px; border-bottom:1px solid #999;" />`
      : `<div style="height:50px; border-bottom:1px solid #999;"></div>`;

  const statement = safe(
    `I, ${rnNameForStatement || "__________"}, RN am delegating this employee for the next (${authDays}) days based on the above criteria and documented assessment in the medical record of the resident being ${
      checklist.stableCondition ? "stable and predictable" : "NOT confirmed as stable and predictable"
    }.`
  );

  return `
  <html><head><meta charset="utf-8" /><title>Delegation Packet</title>
  <style>
    body{font-family:Arial,sans-serif;padding:28px;}
    .box{border:1px solid #e5e7eb;border-radius:12px;padding:12px;margin-top:8px;}
    .row{display:flex;gap:16px;}
    .col{flex:1;}
    .q{margin-top:8px;}
  </style>
  </head><body>
    <h1>${safe(orgName)} — RN Delegation Packet</h1>
    <div class="box"><div class="row">
      <div class="col">
        <b>Resident:</b> ${safe(resident?.name)} (DOB ${safe(resident?.dob)})<br/>
        <b>Regimen:</b> ${safe(resident?.regimen)}
      </div>
      <div class="col"><b>Med-Tech:</b> ${safe(medTech?.name)}</div>
      <div class="col"><b>Task:</b> ${safe(task?.label)}<br/><b>Auth Ends:</b> ${formatDate(delegation?.endDate)}</div>
    </div></div>

    <h2>OBN Checklist</h2>
    <div class="box">Stable: ${checklist.stableCondition ? "YES" : "NO"} | Safe Env: ${checklist.safeEnvironment ? "YES" : "NO"} | UAP Willing: ${checklist.uapWilling ? "YES" : "NO"}</div>

    <h2>Procedure</h2>
    <div class="box"><b>${safe(packet?.title)}</b><ul>${(packet?.steps || [])
      .map((s) => `<li>${safe(s)}</li>`)
      .join("")}</ul></div>

    <h2>Competency</h2>
    <div class="box">
      <b>Methods:</b>
      Lecture: ${competency.lecture ? "Y" : "N"},
      Discussion: ${competency.discussion ? "Y" : "N"},
      Demo: ${competency.demonstration ? "Y" : "N"},
      Return Demo: ${competency.returnDemonstration ? "Y" : "N"},
      Packet Reviewed: ${competency.packetReviewed ? "Y" : "N"}
    </div>

    <h2>Justification</h2>
    <div class="box">
      <div class="q"><b>Length of time RN has worked with employee being delegated:</b><br/>${safe(resolved.rnWorkedWithEmployeeLength)}</div>
      <div class="q"><b>Document method of training/delegating task of administering insulin, including rationale:</b><br/>${safe(resolved.trainingMethodAndRationale)}</div>
      <div class="q"><b>Length of time during career employee has given insulin; include details on within your community and total within career.</b><br/>
        • Within this community: ${safe(resolved.insulinExperienceCommunity)}<br/>
        • Total within career: ${safe(resolved.insulinExperienceCareer)}
      </div>
      <div class="q"><b>Length of time the employee has worked directly with the Resident being delegated and knowledge level of individualized signs and symptoms of hyper/hypoglycemia of this resident:</b><br/>${safe(resolved.residentWorkAndKnowledge)}</div>
      <div class="q"><b>Describe the willingness of the Unlicensed Professional to conduct the delegated task:</b><br/>${safe(resolved.willingnessDescription)}</div>
      <div class="q"><b>Delegation Statement:</b><br/>${statement}</div>
    </div>

    <h2>Signatures</h2>
    <div class="box"><div class="row">
      <div class="col">${sigImg(mtSig?.signatureImage)}<br/><b>MT:</b> ${safe(mtSig?.typedName)}</div>
      <div class="col">${sigImg(rnSig?.signatureImage)}<br/><b>RN:</b> ${safe(rnSig?.typedName)}</div>
    </div></div>
  </body></html>`;
}

function buildAssessmentHTML({ orgName, resident, assessment }) {
  const safe = escapeHtml;
  return `<html><head><meta charset="utf-8" /><title>Assessment</title><style>body{font-family:Arial;padding:40px;}</style></head><body><h1>RN Diabetic Assessment</h1><p><b>Resident:</b> ${safe(
    resident?.name
  )}</p><p><b>Date:</b> ${safe(assessment?.date)}</p><p><b>Type:</b> ${safe(
    assessment?.type
  )}</p><p><b>Status:</b> ${
    assessment?.stable ? "Stable" : "Unstable"
  }</p><h3>Narrative</h3><p>${safe(assessment?.notes)}</p></body></html>`;
}

function buildTranscriptHTML({ orgName, medTech }) {
  const safe = escapeHtml;
  const transcripts = medTech?.trainingTranscript || [];
  return `<html><head><meta charset="utf-8" /><title>Training Transcript</title><style>body{font-family:Arial,sans-serif;padding:40px;} table{width:100%;border-collapse:collapse;margin-top:20px;} th, td{border:1px solid #ddd;padding:10px;text-align:left;} th{background-color:#f3f4f6;}</style></head><body><h1>Training Transcript</h1><p><b>Med-Tech:</b> ${safe(
    medTech?.name
  )}<br/><b>Community:</b> ${safe(
    orgName
  )}</p><table><thead><tr><th>Date</th><th>Topic</th><th>Notes</th></tr></thead><tbody>${
    transcripts.length > 0
      ? transcripts
          .map(
            (t) =>
              `<tr><td>${formatDate(t.date)}</td><td>${safe(
                t.topic
              )}</td><td>${safe(t.notes)}</td></tr>`
          )
          .join("")
      : `<tr><td colspan="3">No records.</td></tr>`
  }</tbody></table></body></html>`;
}

function printPacket(args) {
  const w = window.open("", "_blank");
  w.document.write(buildPacketHTML(args));
  w.document.close();
  setTimeout(() => w.print(), 300);
}
function printAssessment(args) {
  const w = window.open("", "_blank");
  w.document.write(buildAssessmentHTML(args));
  w.document.close();
  setTimeout(() => w.print(), 300);
}
function printTranscript(args) {
  const w = window.open("", "_blank");
  w.document.write(buildTranscriptHTML(args));
  w.document.close();
  setTimeout(() => w.print(), 300);
}

// -------------------- MAIN APP --------------------
//export default function DelegationManagementApp() {
//function DelegationManagementApp() {
const App = () => {
  const TODAY = todayISO();

  // -- UI HELPERS --
  const statusBadge = (d) => {
    if (d.status === "rescinded") return <Badge tone="red">RESCINDED</Badge>;
    if (new Date(d.endDate) < new Date(TODAY)) return <Badge tone="red">OVERDUE</Badge>;
    if (daysBetween(TODAY, d.endDate) <= DUE_SOON_DAYS) return <Badge tone="yellow">DUE SOON</Badge>;
    return <Badge tone="green">ACTIVE</Badge>;
  };

  const supervisionBadge = (d) => {
    if (!d.supervisionDueDate) return <Badge tone="gray">No due date</Badge>;
    const diff = daysBetween(TODAY, d.supervisionDueDate);
    if (diff < 0) return <Badge tone="red">Supervision overdue</Badge>;
    if (diff <= 7) return <Badge tone="yellow">Supervision due</Badge>;
    return <Badge tone="green">Supervision OK</Badge>;
  };

  const renderNextAssessmentBadge = (resident) => {
    const nextDue = resident.nextAssessmentDate
      ? resident.nextAssessmentDate
      : resident.lastAssessmentDate
      ? addDays(resident.lastAssessmentDate, ASSESSMENT_INTERVAL_DAYS)
      : null;

    if (!nextDue) return <Badge tone="gray">Initial Assessment Needed</Badge>;

    const diff = daysBetween(TODAY, nextDue);
    let color = "green";
    if (diff < 0) color = "red";
    else if (diff <= 14) color = "yellow";

    return (
      <Badge tone={color}>
        {diff < 0 ? `Overdue (${formatDate(nextDue)})` : `Due: ${formatDate(nextDue)}`}
      </Badge>
    );
  };

  const [view, setView] = useState("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [delegationStatusFilter, setDelegationStatusFilter] = useState(null);
  const [communities, setCommunities] = useState(MOCK_COMMUNITIES);
  const [activeCommunityId, setActiveCommunityId] = useState("cm-01");
  const [residents, setResidents] = useState(MOCK_RESIDENTS);
  const [medTechs, setMedTechs] = useState(MOCK_MEDTECHS);
  const [delegations, setDelegations] = useState([
    {
      id: "del-expired-001",
      residentId: "res-003",
      medTechId: "mt-001",
      taskId: "insulin-pen",
      startDate: addDays(todayISO(), -100),
      endDate: addDays(todayISO(), -10),
      authDays: 90,
      status: "active",
      checklist: {
        stableCondition: true,
        safeEnvironment: true,
        uapSkills: true,
        uapWilling: true,
        rnAvailable: true,
        writtenInstructions: true,
        nonTransferable: true,
      },
      competencyMethods: {
        lecture: false,
        discussion: true,
        demonstration: true,
        returnDemonstration: true,
        packetReviewed: true,
        other: false,
      },
      justification: {
        rnWorkedWithEmployeeLength: "RN has worked with employee for 5 years (multiple direct observations).",
        trainingMethodAndRationale: "Return demonstration observed; rationale: task is routine, employee is competent and follows policy.",
        insulinExperienceCommunity: "5 years within this community administering insulin per MAR.",
        insulinExperienceCareer: "5+ years total administering insulin across prior roles.",
        residentWorkAndKnowledge: "Worked with resident for 2+ years; recognizes individualized signs of hypoglycemia and hyperglycemia for this resident.",
        willingnessDescription: "Willing; reports concerns and follows RN direction.",
      },
      authJustification:
        "See justification fields (structured) in packet.",
      supervisionDueDate: addDays(todayISO(), -40),
      supervisionHistory: [],
      signatures: {
        rn: { signedAt: addDays(todayISO(), -100), typedName: "Janet Westlund, RN", method: "TYPED" },
        mt: { signedAt: addDays(todayISO(), -100), typedName: "Kevin Mills", method: "TYPED" },
      },
      audit: [
        { at: addDays(todayISO(), -100), action: "CREATED", detail: "Initial Auth 90 days" },
      ],
    },
  ]);
  const [formErrors, setFormErrors] = useState([]);

  const activeCommunity = useMemo(
    () =>
      activeCommunityId === "all"
        ? { name: "All Communities" }
        : communities.find((c) => c.id === activeCommunityId) || { name: "Unknown" },
    [communities, activeCommunityId]
  );

  // Modals
  const [showNewDelegation, setShowNewDelegation] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  const [showPacketModal, setShowPacketModal] = useState(false);
  const [showSupervisionModal, setShowSupervisionModal] = useState(false);
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [showRescindModal, setShowRescindModal] = useState(false);
  const [showAddResident, setShowAddResident] = useState(false);
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [viewResidentId, setViewResidentId] = useState(null);
  const [isEditingResident, setIsEditingResident] = useState(false);
  const [showMtSupervisionModal, setShowMtSupervisionModal] = useState(false);
  const [showTrainingModal, setShowTrainingModal] = useState(false);
  const [showLogTrainingModal, setShowLogTrainingModal] = useState(false);
  const [showAddMedTech, setShowAddMedTech] = useState(false);
  const [editingCommunityId, setEditingCommunityId] = useState(null);

  const getEmptyNewDelegation = () => ({
    residentId: "",
    medTechId: "",
    taskIds: [],
    authDays: DEFAULT_AUTH_DAYS,
    checklist: {
      stableCondition: false,
      safeEnvironment: false,
      uapSkills: false,
      uapWilling: false,
      rnAvailable: false,
      writtenInstructions: false,
      nonTransferable: false,
    },
    competencyMethods: {
      lecture: false,
      discussion: false,
      demonstration: false,
      returnDemonstration: false,
      packetReviewed: false,
      other: false,
    },
    justification: {
      rnWorkedWithEmployeeLength: "",
      trainingMethodAndRationale: "",
      insulinExperienceCommunity: "",
      insulinExperienceCareer: "",
      residentWorkAndKnowledge: "",
      willingnessDescription: "",
    },
  });

  // Forms
  const [newDelegation, setNewDelegation] = useState(getEmptyNewDelegation());

  const [signMode, setSignMode] = useState({
    rnTypedName: "",
    rnUseDrawn: false,
    rnSignatureImage: "",
    rnAttest: {
      taughtAndObserved: false,
      writtenInstructionsProvided: false,
      clientStablePredictable: false,
      supervisionPlanned: false,
    },
    mtTypedName: "",
    mtUseDrawn: false,
    mtSignatureImage: "",
    mtAttest: {
      understandsWhy: false,
      residentSpecificNonTransferable: false,
      willReportConcerns: false,
      acceptsSupervision: false,
    },
  });

  const [supervisionData, setSupervisionData] = useState({
    methods: {
      supervision: false,
      discussion: false,
      demonstration: false,
      returnDemonstration: false,
      lecture: false,
      packetReviewed: false,
      writtenTest: false,
      verbalTest: false,
      other: false,
    },
    otherNarrative: "",
  });

  const [reauthDays, setReauthDays] = useState(DEFAULT_AUTH_DAYS);
  const [reauthCriteriaUnchanged, setReauthCriteriaUnchanged] = useState(true);
  const [reauthCriteriaFields, setReauthCriteriaFields] = useState({
    rnWorkedWithEmployeeLength: "",
    trainingMethodAndRationale: "",
    insulinExperienceCommunity: "",
    insulinExperienceCareer: "",
    residentWorkAndKnowledge: "",
    willingnessDescription: "",
  });

  const [rescindReason, setRescindReason] = useState("");
  const [editResidentForm, setEditResidentForm] = useState(null);

  const [medTechForm, setMedTechForm] = useState({
    name: "",
    experience: "",
    training: "",
    communityId: activeCommunityId === "all" ? communities[0].id : activeCommunityId,
    delegationProfile: {
      rnWorkedWithEmployeeLength: "",
      insulinExperienceCommunity: "",
      insulinExperienceCareer: "",
      willingnessDescription: "",
    },
  });

  const [logTrainingForm, setLogTrainingForm] = useState({
    selectedMedTechIds: [],
    date: TODAY,
    topic: "",
    notes: "",
    methods: {
      careScopeTraining: false,
      lecture: false,
      discussion: false,
      demonstration: false,
      packetReviewed: false,
      other: false,
    },
    otherNarrative: "",
  });

  const [mtSupervisionForm, setMtSupervisionForm] = useState({ date: TODAY, notes: "" });
  const [trainingForm, setTrainingForm] = useState("");
  const [residentForm, setResidentForm] = useState({
    name: "",
    dob: "",
    unit: "",
    diagnosis: "",
    regimen: "",
  });

  const [assessmentForm, setAssessmentForm] = useState({
    type: "Quarterly",
    stable: true,
    notes: "",
    date: TODAY,
    nextDueDate: addDays(TODAY, ASSESSMENT_INTERVAL_DAYS),
  });

  const [editCommunityForm, setEditCommunityForm] = useState(null);

  // Selection
  const [activeMedTechId, setActiveMedTechId] = useState(null);
  const [assessingResidentId, setAssessingResidentId] = useState(null);
  const [selectedDelegationId, setSelectedDelegationId] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  // Derived
  const viewingResident = useMemo(
    () => residents.find((r) => r.id === viewResidentId),
    [residents, viewResidentId]
  );
  const viewingResidentDelegations = useMemo(
    () => (viewResidentId ? delegations.filter((d) => d.residentId === viewResidentId) : []),
    [delegations, viewResidentId]
  );
  const selectedDelegation = useMemo(
    () => delegations.find((d) => d.id === selectedDelegationId) || null,
    [delegations, selectedDelegationId]
  );
  const selectedResident = useMemo(
    () => residents.find((r) => r.id === selectedDelegation?.residentId) || null,
    [residents, selectedDelegation]
  );
  const selectedMedTech = useMemo(
    () => medTechs.find((m) => m.id === selectedDelegation?.medTechId) || null,
    [medTechs, selectedDelegation]
  );
  const selectedTask = useMemo(
    () => DELEGATION_TASKS.find((t) => t.id === selectedDelegation?.taskId) || null,
    [selectedDelegation]
  );

  // Filtering
  const filteredResidents = useMemo(() => {
    let list = residents;
    if (activeCommunityId !== "all") list = residents.filter((r) => r.communityId === activeCommunityId);
    if (searchQuery) list = list.filter((r) => r.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return list;
  }, [residents, searchQuery, activeCommunityId]);

  const filteredMedTechs = useMemo(() => {
    let list = medTechs;
    if (activeCommunityId !== "all") list = medTechs.filter((m) => !m.communityId || m.communityId === activeCommunityId);
    if (searchQuery) list = list.filter((m) => m.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return list;
  }, [medTechs, searchQuery, activeCommunityId]);

  const filteredDelegations = useMemo(() => {
    let list = delegations;
    if (activeCommunityId !== "all") {
      const commResIds = residents.filter((r) => r.communityId === activeCommunityId).map((r) => r.id);
      list = delegations.filter((d) => commResIds.includes(d.residentId));
    }
    if (searchQuery) {
      list = list.filter((d) => {
        const r = residents.find((x) => x.id === d.residentId)?.name || "";
        const m = medTechs.find((x) => x.id === d.medTechId)?.name || "";
        return (
          r.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.toLowerCase().includes(searchQuery.toLowerCase())
        );
      });
    }
    return list;
  }, [delegations, residents, medTechs, searchQuery, activeCommunityId]);

  const delegationsToShow = useMemo(() => {
    if (!delegationStatusFilter) return filteredDelegations;
    switch (delegationStatusFilter) {
      case "active":
        return filteredDelegations.filter((d) => d.status === "active");
      case "dueSoon":
        return filteredDelegations.filter(
          (d) =>
            d.status === "active" &&
            daysBetween(TODAY, d.endDate) >= 0 &&
            daysBetween(TODAY, d.endDate) <= DUE_SOON_DAYS
        );
      case "overdue":
        return filteredDelegations.filter(
          (d) => d.status === "active" && new Date(d.endDate) < new Date(TODAY)
        );
      case "supervisionDue":
        return filteredDelegations.filter(
          (d) =>
            d.status === "active" &&
            d.supervisionDueDate &&
            daysBetween(TODAY, d.supervisionDueDate) <= 7
        );
      case "unsigned":
        return filteredDelegations.filter(
          (d) => d.status === "active" && !(d.signatures?.rn?.signedAt && d.signatures?.mt?.signedAt)
        );
      default:
        return filteredDelegations;
    }
  }, [filteredDelegations, delegationStatusFilter, TODAY]);

  // Group delegations
  const groupedDelegations = useMemo(() => {
    const groups = {};
    delegationsToShow.forEach((d) => {
      const key = `${d.residentId}_${d.medTechId}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(d);
    });
    return groups;
  }, [delegationsToShow]);

  const toggleGroup = (key) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const stats = useMemo(() => {
    const active = filteredDelegations.filter((d) => d.status === "active").length;
    const dueSoon = filteredDelegations.filter(
      (d) =>
        d.status === "active" &&
        daysBetween(TODAY, d.endDate) >= 0 &&
        daysBetween(TODAY, d.endDate) <= DUE_SOON_DAYS
    ).length;
    const overdue = filteredDelegations.filter(
      (d) => d.status === "active" && new Date(d.endDate) < new Date(TODAY)
    ).length;
    const supervisionDue = filteredDelegations.filter(
      (d) => d.status === "active" && d.supervisionDueDate && daysBetween(TODAY, d.supervisionDueDate) <= 7
    ).length;
    const unsigned = filteredDelegations.filter(
      (d) => d.status === "active" && !(d.signatures?.rn?.signedAt && d.signatures?.mt?.signedAt)
    ).length;
    return { active, dueSoon, overdue, supervisionDue, unsigned, total: filteredDelegations.length };
  }, [filteredDelegations, TODAY]);

  // ---- Prefill justification fields from Med-Tech profile (Add Med-Tech menu) ----
  useEffect(() => {
    const mt = medTechs.find((m) => m.id === newDelegation.medTechId);
    if (!mt) return;

    const profile = mt.delegationProfile || {};
    const willingnessFallback =
      profile.willingnessDescription ||
      (mt.willingness === true ? "Willing" : mt.willingness === false ? "Not willing" : "");

    setNewDelegation((prev) => {
      const j = prev.justification || {};
      let changed = false;
      const nextJ = { ...j };

      const fillIfEmpty = (key, value) => {
        if (!nextJ[key] && value) {
          nextJ[key] = value;
          changed = true;
        }
      };

      fillIfEmpty("rnWorkedWithEmployeeLength", profile.rnWorkedWithEmployeeLength);
      fillIfEmpty("insulinExperienceCommunity", profile.insulinExperienceCommunity);
      fillIfEmpty("insulinExperienceCareer", profile.insulinExperienceCareer);
      fillIfEmpty("willingnessDescription", willingnessFallback);

      if (!changed) return prev;
      return { ...prev, justification: nextJ };
    });
  }, [newDelegation.medTechId, medTechs]);

  // Actions
  const handleAddResident = () => {
    if (!residentForm.name) return alert("Name required");
    setResidents((p) => [
      ...p,
      {
        id: uid("res"),
        communityId: activeCommunityId === "all" ? communities[0].id : activeCommunityId,
        ...residentForm,
        assessmentStatus: "Pending",
        assessments: [],
      },
    ]);
    setShowAddResident(false);
  };

  const handleAddMedTech = () => {
    if (!medTechForm.name) return alert("Name required");
    setMedTechs((p) => [
      ...p,
      {
        id: uid("mt"),
        ...medTechForm,
        hireDate: TODAY,
        trainingTranscript: [],
      },
    ]);
    setShowAddMedTech(false);
  };

  const handleLogTraining = () => {
    if (logTrainingForm.selectedMedTechIds.length === 0) return alert("Select at least one Med-Tech.");
    if (!logTrainingForm.topic) return alert("Topic required");
    const methodsList = [];
    if (logTrainingForm.methods.careScopeTraining) methodsList.push("CareScope Diabetic Course 4 Hours");
    if (logTrainingForm.methods.lecture) methodsList.push("Lecture");
    if (logTrainingForm.methods.discussion) methodsList.push("Discussion/Questions");
    if (logTrainingForm.methods.demonstration) methodsList.push("Demonstration");
    if (logTrainingForm.methods.packetReviewed) methodsList.push("Packet Reviewed");
    if (logTrainingForm.methods.other) methodsList.push(`Other: ${logTrainingForm.otherNarrative}`);
    const methodString = methodsList.length > 0 ? `Methods: ${methodsList.join(", ")}` : "";
    const fullNotes = `${methodString}\n${logTrainingForm.notes}`;
    setMedTechs((prev) =>
      prev.map((m) => {
        if (logTrainingForm.selectedMedTechIds.includes(m.id)) {
          const newTranscript = { id: uid("tr"), date: logTrainingForm.date, topic: logTrainingForm.topic, notes: fullNotes };
          return { ...m, trainingTranscript: [newTranscript, ...(m.trainingTranscript || [])], training: logTrainingForm.topic };
        }
        return m;
      })
    );
    setShowLogTrainingModal(false);
  };

  const resetNewDelegation = () => setNewDelegation(getEmptyNewDelegation());

  const createDelegation = () => {
    const errors = [];

    if (!newDelegation.residentId) errors.push("Resident is required");
    if (!newDelegation.medTechId) errors.push("Med-Tech is required");
    if (!newDelegation.taskIds.length) errors.push("Select at least one task");

    const authDays = clampNumber(Number(newDelegation.authDays || DEFAULT_AUTH_DAYS), 1, MAX_AUTH_DAYS);

    // Require stable/predictable attestation for the justification statement
    if (!newDelegation.checklist.stableCondition) errors.push("Resident must be marked Stable & Predictable");

    const jf = newDelegation.justification || {};
    const requiredFields = [
      ["rnWorkedWithEmployeeLength", "Length of time RN has worked with employee"],
      ["trainingMethodAndRationale", "Method of training/delegating + rationale"],
      ["insulinExperienceCommunity", "Insulin experience within your community"],
      ["insulinExperienceCareer", "Insulin experience total within career"],
      ["residentWorkAndKnowledge", "Worked with resident + individualized signs/symptoms knowledge"],
      ["willingnessDescription", "Willingness of UAP to conduct delegated task"],
    ];
    requiredFields.forEach(([k, label]) => {
      if (!jf[k] || !jf[k].trim()) errors.push(`Justification required: ${label}`);
    });

    if (errors.length) {
      setFormErrors(errors);
      return alert(errors.join("\n"));
    }

    const orgRNName = activeCommunity?.rn?.name || "";
    const authText = composeDelegationJustificationText({
      rnName: orgRNName,
      authDays,
      stablePredictable: !!newDelegation.checklist.stableCondition,
      fields: jf,
    });

    const startDate = TODAY;
    const endDate = addDays(startDate, authDays);

    const createdAt = new Date().toISOString();
    const news = newDelegation.taskIds.map((tid) => ({
      id: uid("del"),
      residentId: newDelegation.residentId,
      medTechId: newDelegation.medTechId,
      taskId: tid,
      startDate,
      endDate,
      authDays,
      status: "active",
      checklist: newDelegation.checklist,
      competencyMethods: newDelegation.competencyMethods,
      justification: jf,
      authJustification: authText,
      delegatingRNName: orgRNName,
      supervisionDueDate: addDays(startDate, INITIAL_REEVAL_DUE_DAYS),
      signatures: { rn: null, mt: null },
      audit: [{ at: createdAt, action: "CREATED", detail: `Initial Auth ${authDays} days` }],
    }));

    setDelegations((p) => [...news, ...p]);
    setShowNewDelegation(false);
    resetNewDelegation();
    setFormErrors([]);
  };

  const confirmRescind = () => {
    if (!rescindReason) return alert("Reason required");
    setDelegations((p) =>
      p.map((d) =>
        d.id === selectedDelegationId
          ? { ...d, status: "rescinded", rescindReason, rescindDate: TODAY }
          : d
      )
    );
    setShowRescindModal(false);
  };

  const openReauthModal = (id) => {
    setSelectedDelegationId(id);
    const d = delegations.find((x) => x.id === id);
    const existing = d?.justification || {};

    setReauthDays(DEFAULT_AUTH_DAYS);
    setReauthCriteriaUnchanged(true);
    setReauthCriteriaFields({
      rnWorkedWithEmployeeLength: existing.rnWorkedWithEmployeeLength || "",
      trainingMethodAndRationale: existing.trainingMethodAndRationale || "",
      insulinExperienceCommunity: existing.insulinExperienceCommunity || "",
      insulinExperienceCareer: existing.insulinExperienceCareer || "",
      residentWorkAndKnowledge: existing.residentWorkAndKnowledge || "",
      willingnessDescription: existing.willingnessDescription || "",
    });

    setShowReauthModal(true);
  };

  const confirmReauth = () => {
    const authDays = clampNumber(Number(reauthDays || DEFAULT_AUTH_DAYS), 1, MAX_AUTH_DAYS);

    setDelegations((p) =>
      p.map((d) => {
        if (d.id !== selectedDelegationId) return d;

        const fieldsToUse = reauthCriteriaUnchanged ? (d.justification || {}) : reauthCriteriaFields;

        // If user chose "unchanged", we still regenerate the statement so the days reflect the new authorization length.
        const orgRNName = activeCommunity?.rn?.name || "";
        const authText = composeDelegationJustificationText({
          rnName: d.delegatingRNName || orgRNName,
          authDays,
          stablePredictable: !!d?.checklist?.stableCondition,
          fields: fieldsToUse,
        });

        return {
          ...d,
          endDate: addDays(TODAY, authDays),
          authDays,
          supervisionDueDate: addDays(TODAY, Math.min(authDays, MAX_AUTH_DAYS)),
          justification: fieldsToUse,
          authJustification: authText,
          audit: [
            ...(d.audit || []),
            {
              at: new Date().toISOString(),
              action: "REAUTHORIZED",
              detail: reauthCriteriaUnchanged
                ? `Extended ${authDays} days (criteria unchanged)`
                : `Extended ${authDays} days (criteria updated)`,
            },
          ],
        };
      })
    );

    setShowReauthModal(false);
  };

  const saveSupervisionLog = () => {
    setDelegations((p) =>
      p.map((d) =>
        d.id === selectedDelegationId
          ? { ...d, supervisionDueDate: addDays(TODAY, MAX_AUTH_DAYS) }
          : d
      )
    );
    setShowSupervisionModal(false);
  };

  const saveSignatures = () => {
    const now = new Date().toISOString();
    setDelegations((p) =>
      p.map((d) =>
        d.id === selectedDelegationId
          ? {
              ...d,
              delegatingRNName: signMode.rnTypedName || d.delegatingRNName,
              signatures: {
                rn: {
                  signedAt: now,
                  typedName: signMode.rnTypedName,
                  signatureImage: signMode.rnSignatureImage,
                },
                mt: {
                  signedAt: now,
                  typedName: signMode.mtTypedName,
                  signatureImage: signMode.mtSignatureImage,
                },
              },
            }
          : d
      )
    );
    setShowSignModal(false);
  };

  const updateAssessmentForm = (field, value) => {
    setAssessmentForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "type" || field === "date") {
        const baseDate = field === "date" ? value : prev.date;
        const type = field === "type" ? value : prev.type;
        if (type === "Quarterly" || type === "Initial") {
          next.nextDueDate = addDays(baseDate, ASSESSMENT_INTERVAL_DAYS);
        }
      }
      return next;
    });
  };

  const saveAssessment = () => {
    if (!assessingResidentId) return;
    setResidents((p) =>
      p.map((r) =>
        r.id === assessingResidentId
          ? {
              ...r,
              lastAssessmentDate: assessmentForm.date,
              nextAssessmentDate: assessmentForm.nextDueDate,
              assessmentStatus: assessmentForm.stable ? "Stable" : "Unstable",
              assessments: [
                {
                  ...assessmentForm,
                  nextDue: assessmentForm.nextDueDate,
                },
                ...(r.assessments || []),
              ],
            }
          : r
      )
    );
    setShowAssessmentModal(false);
  };

  const saveCommunity = () => {
    if (!editingCommunityId || !editCommunityForm) return;
    setCommunities((p) => p.map((c) => (c.id === editingCommunityId ? editCommunityForm : c)));
    setEditingCommunityId(null);
  };

  const handleAddCommunity = () => {
    const name = prompt("Enter community name:");
    if (!name) return;
    const newCm = {
      id: uid("cm"),
      name,
      admin: { name: "", email: "", phone: "" },
      rn: { name: "", email: "", phone: "" },
      notifications: { regionalOps: "", regionalNurse: "" },
    };
    setCommunities((p) => [...p, newCm]);
  };

  const handleDeleteCommunity = (id) => {
    if (window.confirm("Delete this community?")) setCommunities((p) => p.filter((c) => c.id !== id));
  };

  const saveMtSupervision = () => {
    setMedTechs((p) =>
      p.map((m) => (m.id === activeMedTechId ? { ...m, lastSupervision: mtSupervisionForm.date } : m))
    );
    setShowMtSupervisionModal(false);
  };

  const saveTraining = () => {
    setMedTechs((p) => p.map((m) => (m.id === activeMedTechId ? { ...m, training: trainingForm } : m)));
    setShowTrainingModal(false);
  };

  const openPacket = (id) => {
    setSelectedDelegationId(id);
    setShowPacketModal(true);
  };
  const openSign = (id) => {
    setSelectedDelegationId(id);
    setShowSignModal(true);
  };
  const openSupervisionModal = (id) => {
    setSelectedDelegationId(id);
    setShowSupervisionModal(true);
  };
  const openRescindModal = (id) => {
    setSelectedDelegationId(id);
    setRescindReason("");
    setShowRescindModal(true);
  };

  const handlePrintDelegation = (d) => {
    const r = residents.find((x) => x.id === d.residentId);
    const m = medTechs.find((x) => x.id === d.medTechId);
    const t = DELEGATION_TASKS.find((x) => x.id === d.taskId);
    const p = TASK_PACKET_SNIPPETS[d.taskId];
    printPacket({
      orgName: activeCommunity.name || "CareScope",
      orgRNName: activeCommunity?.rn?.name || "",
      delegation: d,
      resident: r,
      medTech: m,
      task: t,
      packet: p,
      rnSig: d.signatures?.rn,
      mtSig: d.signatures?.mt,
    });
  };

  const openAssessmentModal = (id) => {
    setAssessingResidentId(id);
    setAssessmentForm({
      type: "Quarterly",
      stable: true,
      notes: "",
      date: TODAY,
      nextDueDate: addDays(TODAY, ASSESSMENT_INTERVAL_DAYS),
    });
    setShowAssessmentModal(true);
  };

  // Helper for resident profile actions
  const handleEditResidentClick = () => {
    if (!viewingResident) return;
    setEditResidentForm({ ...viewingResident });
    setIsEditingResident(true);
  };
  const handleCancelEditResident = () => {
    setIsEditingResident(false);
    setEditResidentForm(null);
  };
  const handleSaveResidentChanges = () => {
    if (!editResidentForm) return;
    setResidents((prev) => prev.map((r) => (r.id === editResidentForm.id ? editResidentForm : r)));
    setIsEditingResident(false);
    setEditResidentForm(null);
  };

  // Render components...
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <header className="bg-indigo-600 text-white px-5 py-4 shadow-md flex justify-between items-center">
        <div className="flex items-center gap-3">
          //<ShieldCheck size={28} />
          <div>
            <div className="text-xl font-extrabold">CareScope360 RN Delegations</div>
            <div className="text-xs flex items-center gap-1">
              <Building size={10} />
              <select
                className="bg-transparent font-bold cursor-pointer text-white"
                value={activeCommunityId}
                onChange={(e) => setActiveCommunityId(e.target.value)}
              >
                <option value="all" className="text-black">
                  All Communities
                </option>
                {communities.map((c) => (
                  <option key={c.id} value={c.id} className="text-black">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="hidden md:flex gap-2">
          {["dashboard", "residents", "medtechs", "delegations", "admin"].map((v) => (
            <NavButton
              key={v}
              id={v}
              label={v.charAt(0).toUpperCase() + v.slice(1)}
              icon={null}
              currentView={view}
              onClick={setView}
            />
          ))}
        </div>
      </header>

      {/* Mobile nav */}
      <div className="md:hidden grid grid-cols-3 gap-2 mb-4 p-4 pb-0">
        <NavButton id="dashboard" label="Dash" icon={<LayoutDashboard size={18} />} currentView={view} onClick={setView} />
        <NavButton id="residents" label="Residents" icon={<Users size={18} />} currentView={view} onClick={setView} />
        <NavButton id="medtechs" label="Med-Techs" icon={<ClipboardList size={18} />} currentView={view} onClick={setView} />
        <NavButton id="delegations" label="Delegations" icon={<CalendarCheck size={18} />} currentView={view} onClick={setView} />
        <NavButton id="admin" label="Admin" icon={<Settings size={18} />} currentView={view} onClick={setView} />
      </div>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {view === "dashboard" && (
          <>
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Dashboard for {activeCommunity.name}</h2>
              <Button onClick={() => setShowNewDelegation(true)}>
                <Plus size={18} /> New Delegation
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <Card title="Active" value={stats.active} tone="green" onClick={() => { setView("delegations"); setDelegationStatusFilter("active"); }} />
              <Card title="Due Soon" value={stats.dueSoon} tone={stats.dueSoon > 0 ? "red" : "yellow"} onClick={() => { setView("delegations"); setDelegationStatusFilter("dueSoon"); }} />
              <Card title="Overdue" value={stats.overdue} tone={stats.overdue > 0 ? "red" : "green"} onClick={() => { setView("delegations"); setDelegationStatusFilter("overdue"); }} />
              <Card title="Supervision Due" value={stats.supervisionDue} tone={stats.supervisionDue > 0 ? "red" : "yellow"} onClick={() => { setView("delegations"); setDelegationStatusFilter("supervisionDue"); }} />
              <Card title="Unsigned" value={stats.unsigned} tone={stats.unsigned > 0 ? "red" : "indigo"} onClick={() => { setView("delegations"); setDelegationStatusFilter("unsigned"); }} />
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 overflow-auto">
              <h3 className="text-xl font-bold mb-4">Recent Delegations</h3>
              <table className="w-full text-sm">
                <thead className="text-left bg-gray-50 border-b">
                  <tr>
                    <th className="p-3">Resident</th>
                    <th className="p-3">Med-Tech</th>
                    <th className="p-3">Community</th>
                    <th className="p-3">Task</th>
                    <th className="p-3">Auth Ends</th>
                    <th className="p-3">Supervision</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {delegationsToShow.slice(0, 8).map((d) => {
                    const r = residents.find((x) => x.id === d.residentId);
                    const m = medTechs.find((x) => x.id === d.medTechId);
                    const c = communities.find((x) => x.id === r?.communityId);
                    const t = DELEGATION_TASKS.find((x) => x.id === d.taskId);
                    return (
                      <tr key={d.id} className="border-b">
                        <td className="p-3 font-semibold">{r?.name}</td>
                        <td className="p-3">{m?.name}</td>
                        <td className="p-3 text-xs">{c?.name}</td>
                        <td className="p-3">{t?.label}</td>
                        <td className="p-3">
                          <div className="flex flex-col">
                            <span className="font-medium">{formatDate(d.endDate)}</span>
                            {statusBadge(d)}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col">
                            <span className="text-xs text-gray-500">Due {formatDate(d.supervisionDueDate)}</span>
                            {supervisionBadge(d)}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-2">
                            <Button variant="secondary" onClick={() => handlePrintDelegation(d)} title="Print Packet">
                              <Printer size={16} /> Print Packet
                            </Button>
                            <Button variant="secondary" onClick={() => openSign(d.id)} title="Sign">
                              <PenLine size={16} /> Sign
                            </Button>
                            <Button variant="secondary" onClick={() => handlePrintDelegation(d)} title="Print">
                              <Printer size={16} /> Print
                            </Button>
                            <Button variant="secondary" onClick={() => openSupervisionModal(d.id)} disabled={d.status !== "active"} title="Log Personal Observation">
                              <CalendarCheck size={16} /> Log Personal Observation
                            </Button>
                            <Button variant="secondary" onClick={() => openReauthModal(d.id)} disabled={d.status !== "active"} title="Reauthorize">
                              <Calendar size={16} /> Reauthorize
                            </Button>
                            <Button variant="danger" onClick={() => openRescindModal(d.id)} disabled={d.status !== "active"} title="Rescind">
                              <Trash2 size={16} /> Rescind
                            </Button>
                            <Button variant="secondary" onClick={() => handlePrintDelegation(d)} title="Download PDF">
                              <Download size={16} /> Download PDF
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {view === "delegations" && (
          <div className="space-y-4">
            <div className="flex justify-between">
              <h2 className="text-2xl font-bold">Delegations at {activeCommunity.name}</h2>
              <Button onClick={() => setShowNewDelegation(true)}>
                <Plus size={18} /> New
              </Button>
            </div>
            {delegationStatusFilter && (
              <div className="bg-indigo-50 p-2 text-indigo-800 rounded">
                Filter: <strong>{delegationStatusFilter}</strong>{" "}
                <button onClick={() => setDelegationStatusFilter(null)} className="underline ml-2">
                  Clear
                </button>
              </div>
            )}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-left bg-gray-50 border-b">
                  <tr>
                    <th className="p-4">Resident</th>
                    <th className="p-4">Med-Tech</th>
                    <th className="p-4">Community</th>
                    <th className="p-4">Task</th>
                    <th className="p-4">Authorization Ends</th>
                    <th className="p-4">Supervision</th>
                    <th className="p-4">Signatures</th>
                    <th className="p-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(groupedDelegations).length > 0 ? (
                    Object.keys(groupedDelegations).map((key) => {
                      const group = groupedDelegations[key];
                      const first = group[0];
                      const r = residents.find((x) => x.id === first.residentId);
                      const m = medTechs.find((x) => x.id === first.medTechId);
                      const c = communities.find((x) => x.id === r?.communityId);
                      const isExpanded = expandedGroups.has(key);
                      const taskCount = group.length;

                      return (
                        <React.Fragment key={key}>
                          {/* Summary Row */}
                          <tr
                            className="border-b last:border-b-0 cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
                            onClick={() => toggleGroup(key)}
                          >
                            <td className="p-4 font-bold text-gray-900">{r?.name || "—"}</td>
                            <td className="p-4 font-bold text-gray-900">{m?.name || "—"}</td>
                            <td className="p-4 text-xs font-medium text-indigo-700">{c?.name || "—"}</td>
                            <td className="p-4 text-gray-700 font-medium">
                              {taskCount} Active Delegation{taskCount !== 1 ? "s" : ""}
                            </td>
                            <td colSpan={3} className="p-4 text-xs text-gray-500 italic">
                              Click to view details...
                            </td>
                            <td className="p-4 text-gray-400">{isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</td>
                          </tr>

                          {/* Detail Rows */}
                          {isExpanded &&
                            group.map((d) => {
                              const t = DELEGATION_TASKS.find((x) => x.id === d.taskId);
                              const signed = d.signatures?.rn?.signedAt && d.signatures?.mt?.signedAt;
                              return (
                                <tr key={d.id} className="border-b bg-white">
                                  <td className="p-4 pl-8 border-l-4 border-indigo-100"></td>
                                  <td className="p-4"></td>
                                  <td className="p-4"></td>
                                  <td className="p-4">
                                    <div className="flex flex-col">
                                      <span className="font-semibold text-gray-800">{t?.label || "—"}</span>
                                      <span className="text-xs text-gray-500">Template: {t?.formTemplate || "—"}</span>
                                    </div>
                                  </td>
                                  <td className="p-4">
                                    <div className="flex flex-col items-start gap-1">
                                      <span className="font-medium">{formatDate(d.endDate)}</span>
                                      {statusBadge(d)}
                                    </div>
                                  </td>
                                  <td className="p-4">
                                    <div className="flex flex-col items-start gap-1">
                                      <span className="text-xs text-gray-500">Due {formatDate(d.supervisionDueDate)}</span>
                                      {supervisionBadge(d)}
                                    </div>
                                  </td>
                                  <td className="p-4">{signed ? <Badge tone="green">Signed</Badge> : <Badge tone="yellow">Pending</Badge>}</td>
                                  <td className="p-4">
                                    <div className="flex flex-wrap gap-2">
                                      <Button variant="secondary" onClick={() => handlePrintDelegation(d)} title="Print Packet">
                                        <Printer size={16} /> Print Packet
                                      </Button>
                                      <Button variant="secondary" onClick={() => openSign(d.id)} title="Sign">
                                        <PenLine size={16} /> Sign
                                      </Button>
                                      <Button variant="secondary" onClick={() => handlePrintDelegation(d)} title="Print">
                                        <Printer size={16} /> Print
                                      </Button>
                                      <Button
                                        variant="secondary"
                                        onClick={() => openSupervisionModal(d.id)}
                                        disabled={d.status !== "active"}
                                        title="Log Personal Observation"
                                      >
                                        <CalendarCheck size={16} /> Log Personal Observation
                                      </Button>
                                      <Button
                                        variant="secondary"
                                        onClick={() => openReauthModal(d.id)}
                                        disabled={d.status !== "active"}
                                        title="Reauthorize"
                                      >
                                        <Calendar size={16} /> Reauthorize
                                      </Button>
                                      <Button
                                        variant="danger"
                                        onClick={() => openRescindModal(d.id)}
                                        disabled={d.status !== "active"}
                                        title="Rescind"
                                      >
                                        <Trash2 size={16} /> Rescind
                                      </Button>
                                      <Button variant="secondary" onClick={() => handlePrintDelegation(d)} title="Download PDF">
                                        <Download size={16} /> Download PDF
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                        </React.Fragment>
                      );
                    })
                  ) : (
                    <tr>
                      <td className="p-6 text-gray-500" colSpan={8}>
                        No delegations match your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === "residents" && (
          <div className="space-y-4">
            <div className="flex justify-between">
              <h2 className="text-2xl font-bold">Residents at {activeCommunity.name}</h2>
              <Button onClick={() => setShowAddResident(true)}>
                <Plus size={18} /> Add Resident
              </Button>
            </div>
            <div className="bg-white rounded-2xl border p-4 overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-left bg-gray-50 border-b">
                  <tr>
                    <th className="p-3">Unit</th>
                    <th className="p-3">Name</th>
                    <th className="p-3">Diagnosis</th>
                    <th className="p-3">Next Due</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResidents.map((r) => {
                    const next = r.nextAssessmentDate || (r.lastAssessmentDate ? addDays(r.lastAssessmentDate, ASSESSMENT_INTERVAL_DAYS) : null);
                    const diff = next ? daysBetween(TODAY, next) : -999;
                    const tone = !next ? "gray" : diff < 0 ? "red" : diff <= 14 ? "yellow" : "green";
                    return (
                      <tr
                        key={r.id}
                        onClick={() => setViewResidentId(r.id)}
                        className="border-b cursor-pointer hover:bg-indigo-50"
                      >
                        <td className="p-3">{r.unit}</td>
                        <td className="p-3 font-semibold">{r.name}</td>
                        <td className="p-3">{r.diagnosis}</td>
                        <td className="p-3">{next ? <Badge tone={tone}>Due {formatDate(next)}</Badge> : "Initial"}</td>
                        <td className="p-3">
                          <Button
                            variant="secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              openAssessmentModal(r.id);
                            }}
                          >
                            <Activity size={16} /> Add Diabetic Assessment
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === "medtechs" && (
          <div className="space-y-4">
            <div className="flex justify-between">
              <h2 className="text-2xl font-bold">Med-Techs at {activeCommunity.name}</h2>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setLogTrainingForm({
                      selectedMedTechIds: [],
                      date: TODAY,
                      topic: "",
                      notes: "",
                      methods: {
                        careScopeTraining: false,
                        lecture: false,
                        discussion: false,
                        demonstration: false,
                        packetReviewed: false,
                        other: false,
                      },
                      otherNarrative: "",
                    });
                    setShowLogTrainingModal(true);
                  }}
                >
                  <Plus size={18} /> Log New Training
                </Button>
                <Button onClick={() => setShowAddMedTech(true)}>
                  <Plus size={18} /> Add Med-Tech
                </Button>
              </div>
            </div>
            <div className="bg-white rounded-2xl border p-4 overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-left bg-gray-50 border-b">
                  <tr>
                    <th className="p-3">Name</th>
                    <th className="p-3">Training</th>
                    <th className="p-3">Last Training Date</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMedTechs.map((m) => {
                    const latest =
                      m.trainingTranscript && m.trainingTranscript.length > 0
                        ? [...m.trainingTranscript].sort((a, b) => new Date(b.date) - new Date(a.date))[0]
                        : null;
                    const displayTraining = latest ? latest.topic : m.training;
                    const displayDate = latest ? formatDate(latest.date) : "—";
                    return (
                      <tr key={m.id} className="border-b">
                        <td className="p-3 font-semibold">{m.name}</td>
                        <td className="p-3">{displayTraining}</td>
                        <td className="p-3">{displayDate}</td>
                        <td className="p-3 flex gap-2">
                          <Button variant="secondary" onClick={() => { setActiveMedTechId(m.id); setShowMtSupervisionModal(true); }}>
                            <CheckSquare size={16} /> Log Personal Observation
                          </Button>
                          <Button variant="secondary" onClick={() => { setActiveMedTechId(m.id); setShowTrainingModal(true); }}>
                            <BookOpen size={16} /> View Training
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === "admin" && (
          <div>
            <div className="flex justify-between mb-4">
              <h2 className="text-2xl font-bold">Community Administration Menu</h2>
              <div className="flex gap-2">
                <Button onClick={() => alert("Forms feature coming soon.")}>
                  <FileText size={18} /> Forms
                </Button>
                <Button onClick={handleAddCommunity}>
                  <Plus size={18} /> Add Community
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {communities.map((c) => (
                <div
                  key={c.id}
                  className={`bg-white rounded-2xl border p-4 shadow-sm ${
                    activeCommunityId === c.id ? "border-indigo-500 ring-1" : "border-gray-200"
                  }`}
                >
                  <div className="font-bold text-lg mb-2">
                    {c.name} {activeCommunityId === c.id && <Badge tone="indigo">Active</Badge>}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setEditingCommunityId(c.id);
                        setEditCommunityForm(c);
                      }}
                      className="flex-1"
                    >
                      Edit
                    </Button>
                    {activeCommunityId !== c.id && (
                      <Button variant="ghost" onClick={() => setActiveCommunityId(c.id)} className="flex-1">
                        Switch To
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* MODALS */}
      <Modal
        title="New Delegation"
        open={showNewDelegation}
        onClose={() => setShowNewDelegation(false)}
        footer={<Button onClick={createDelegation}>Create</Button>}
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Resident</Label>
            <select
              className="w-full border p-2 rounded"
              value={newDelegation.residentId}
              onChange={(e) => setNewDelegation({ ...newDelegation, residentId: e.target.value })}
            >
              <option value="">Select...</option>
              {residents
                .filter((r) => r.communityId === activeCommunityId || activeCommunityId === "all")
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <Label>Med-Tech</Label>
            <select
              className="w-full border p-2 rounded"
              value={newDelegation.medTechId}
              onChange={(e) => setNewDelegation({ ...newDelegation, medTechId: e.target.value })}
            >
              <option value="">Select...</option>
              {medTechs.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label>Authorization Days (max {MAX_AUTH_DAYS})</Label>
            <input
              type="number"
              className="w-full border p-2 rounded"
              value={newDelegation.authDays}
              onChange={(e) =>
                setNewDelegation({
                  ...newDelegation,
                  authDays: clampNumber(Number(e.target.value || DEFAULT_AUTH_DAYS), 1, MAX_AUTH_DAYS),
                })
              }
            />
          </div>

          <div>
            <Label>Stable & Predictable (Required)</Label>
            <div className="border rounded p-1">
              <Checkbox
                label="Resident is stable and predictable (documented in medical record)"
                checked={newDelegation.checklist.stableCondition}
                onChange={(v) =>
                  setNewDelegation((p) => ({
                    ...p,
                    checklist: { ...p.checklist, stableCondition: v },
                  }))
                }
              />
            </div>
          </div>

          <div className="col-span-2">
            <Label>Tasks</Label>
            <div className="h-32 overflow-y-auto border p-2">
              {DELEGATION_TASKS.map((t) => (
                <label key={t.id} className="flex gap-2">
                  <input
                    type="checkbox"
                    checked={newDelegation.taskIds.includes(t.id)}
                    onChange={(e) => {
                      const s = new Set(newDelegation.taskIds);
                      e.target.checked ? s.add(t.id) : s.delete(t.id);
                      setNewDelegation({ ...newDelegation, taskIds: Array.from(s) });
                    }}
                  />{" "}
                  {t.label}
                </label>
              ))}
            </div>
          </div>

          {/* --- Structured Justification (replaces single narrative box) --- */}
          <div className="col-span-2">
            <div className="bg-gray-50 border rounded-xl p-3">
              <div className="font-bold text-gray-900 mb-2">Justification (Required)</div>

              <div className="space-y-3">
                <div>
                  <Label>Length of time RN has worked with employee being delegated:</Label>
                  <input
                    className="w-full border p-2 rounded"
                    value={newDelegation.justification.rnWorkedWithEmployeeLength}
                    onChange={(e) =>
                      setNewDelegation((p) => ({
                        ...p,
                        justification: { ...p.justification, rnWorkedWithEmployeeLength: e.target.value },
                      }))
                    }
                  />
                </div>

                <div>
                  <Label>Document method of training/delegating task of administering insulin, including rationale:</Label>
                  <textarea
                    className="w-full border p-2 rounded h-24"
                    value={newDelegation.justification.trainingMethodAndRationale}
                    onChange={(e) =>
                      setNewDelegation((p) => ({
                        ...p,
                        justification: { ...p.justification, trainingMethodAndRationale: e.target.value },
                      }))
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Length of time employee has given insulin (within your community):</Label>
                    <input
                      className="w-full border p-2 rounded"
                      value={newDelegation.justification.insulinExperienceCommunity}
                      onChange={(e) =>
                        setNewDelegation((p) => ({
                          ...p,
                          justification: { ...p.justification, insulinExperienceCommunity: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Length of time employee has given insulin (total within career):</Label>
                    <input
                      className="w-full border p-2 rounded"
                      value={newDelegation.justification.insulinExperienceCareer}
                      onChange={(e) =>
                        setNewDelegation((p) => ({
                          ...p,
                          justification: { ...p.justification, insulinExperienceCareer: e.target.value },
                        }))
                      }
                    />
                  </div>
                </div>

                <div>
                  <Label>
                    Length of time the employee has worked directly with the Resident being delegated and knowledge level of individualized signs and symptoms of hyper/hypoglycemia of this resident.
                  </Label>
                  <textarea
                    className="w-full border p-2 rounded h-24"
                    value={newDelegation.justification.residentWorkAndKnowledge}
                    onChange={(e) =>
                      setNewDelegation((p) => ({
                        ...p,
                        justification: { ...p.justification, residentWorkAndKnowledge: e.target.value },
                      }))
                    }
                  />
                </div>

                <div>
                  <Label>Describe the willingness of the Unlicensed Professional to conduct the delegated task.</Label>
                  <textarea
                    className="w-full border p-2 rounded h-20"
                    value={newDelegation.justification.willingnessDescription}
                    onChange={(e) =>
                      setNewDelegation((p) => ({
                        ...p,
                        justification: { ...p.justification, willingnessDescription: e.target.value },
                      }))
                    }
                  />
                </div>

                {/* Optional preview (no UI style change beyond a small box) */}
                <div className="border rounded p-2 bg-white">
                  <div className="text-xs font-semibold text-gray-700 mb-1">Statement Preview</div>
                  <div className="text-xs text-gray-600 whitespace-pre-wrap">
                    {composeDelegationJustificationText({
                      rnName: activeCommunity?.rn?.name || "",
                      authDays: clampNumber(Number(newDelegation.authDays || DEFAULT_AUTH_DAYS), 1, MAX_AUTH_DAYS),
                      stablePredictable: !!newDelegation.checklist.stableCondition,
                      fields: newDelegation.justification,
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {formErrors?.length ? (
            <div className="col-span-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-800">
              <div className="font-bold mb-1">Please fix:</div>
              <ul className="list-disc ml-5">
                {formErrors.map((e, idx) => (
                  <li key={idx}>{e}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </Modal>

      {/* Restored Log Training Modal */}
      <Modal
        title="Log New Training"
        open={showLogTrainingModal}
        onClose={() => setShowLogTrainingModal(false)}
        footer={<Button onClick={handleLogTraining}>Save Record</Button>}
      >
        <div className="space-y-4">
          <div>
            <Label>Select Med-Techs (Multi-Select)</Label>
            <div className="border rounded p-2 max-h-32 overflow-y-auto grid grid-cols-2 gap-2">
              {medTechs
                .filter((m) => activeCommunityId === "all" || m.communityId === activeCommunityId)
                .map((m) => (
                  <label key={m.id} className="flex gap-2 items-center text-sm">
                    <input
                      type="checkbox"
                      checked={logTrainingForm.selectedMedTechIds.includes(m.id)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setLogTrainingForm((prev) => ({
                          ...prev,
                          selectedMedTechIds: checked
                            ? [...prev.selectedMedTechIds, m.id]
                            : prev.selectedMedTechIds.filter((id) => id !== m.id),
                        }));
                      }}
                    />
                    {m.name}
                  </label>
                ))}
            </div>
          </div>
          <div>
            <Label>Date</Label>
            <input
              type="date"
              className="w-full border p-2 rounded"
              value={logTrainingForm.date}
              onChange={(e) => setLogTrainingForm({ ...logTrainingForm, date: e.target.value })}
            />
          </div>

          <div>
            <Label>Training Methods</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <Checkbox
                label="CareScope Diabetic Course 4 Hours"
                checked={logTrainingForm.methods.careScopeTraining}
                onChange={(v) => setLogTrainingForm((p) => ({ ...p, methods: { ...p.methods, careScopeTraining: v } }))}
              />
              <Checkbox
                label="Lecture"
                checked={logTrainingForm.methods.lecture}
                onChange={(v) => setLogTrainingForm((p) => ({ ...p, methods: { ...p.methods, lecture: v } }))}
              />
              <Checkbox
                label="Discussion/Questions"
                checked={logTrainingForm.methods.discussion}
                onChange={(v) => setLogTrainingForm((p) => ({ ...p, methods: { ...p.methods, discussion: v } }))}
              />
              <Checkbox
                label="Demonstration"
                checked={logTrainingForm.methods.demonstration}
                onChange={(v) => setLogTrainingForm((p) => ({ ...p, methods: { ...p.methods, demonstration: v } }))}
              />
              <Checkbox
                label="Packet Reviewed"
                checked={logTrainingForm.methods.packetReviewed}
                onChange={(v) => setLogTrainingForm((p) => ({ ...p, methods: { ...p.methods, packetReviewed: v } }))}
              />
              <Checkbox
                label="Other"
                checked={logTrainingForm.methods.other}
                onChange={(v) => setLogTrainingForm((p) => ({ ...p, methods: { ...p.methods, other: v } }))}
              />
            </div>
            {logTrainingForm.methods.other && (
              <input
                className="w-full border p-2 rounded mt-2"
                placeholder="Describe other method..."
                value={logTrainingForm.otherNarrative}
                onChange={(e) => setLogTrainingForm({ ...logTrainingForm, otherNarrative: e.target.value })}
              />
            )}
          </div>

          <div>
            <Label>Topic</Label>
            <input
              className="w-full border p-2 rounded"
              placeholder="e.g., Insulin Administration, Hypoglycemia"
              value={logTrainingForm.topic}
              onChange={(e) => setLogTrainingForm({ ...logTrainingForm, topic: e.target.value })}
            />
          </div>
          <div>
            <Label>Notes/Competency Details</Label>
            <textarea
              className="w-full border p-2 rounded h-24"
              value={logTrainingForm.notes}
              onChange={(e) => setLogTrainingForm({ ...logTrainingForm, notes: e.target.value })}
            />
          </div>
        </div>
      </Modal>

      {/* Reauthorize: ask if authorization is still correct or corrections needed */}
      <Modal
        title="Reauthorize"
        open={showReauthModal}
        onClose={() => setShowReauthModal(false)}
        footer={<Button onClick={confirmReauth}>Confirm</Button>}
      >
        <div className="space-y-4">
          <div>
            <Label>Duration (Days)</Label>
            <input
              type="number"
              className="w-full border p-2 rounded"
              value={reauthDays}
              onChange={(e) => setReauthDays(Number(e.target.value))}
            />
            <div className="text-xs text-gray-500 mt-1">Max {MAX_AUTH_DAYS} days</div>
          </div>

          <div className="border rounded-xl p-3 bg-gray-50">
            <Label>Is the current authorization criteria still correct?</Label>
            <div className="flex gap-6 text-sm mt-1">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={reauthCriteriaUnchanged}
                  onChange={() => setReauthCriteriaUnchanged(true)}
                />
                Still correct (no changes)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={!reauthCriteriaUnchanged}
                  onChange={() => setReauthCriteriaUnchanged(false)}
                />
                Needs corrections (edit)
              </label>
            </div>

            {!reauthCriteriaUnchanged && (
              <div className="mt-3 space-y-3">
                <div>
                  <Label>Length of time RN has worked with employee being delegated:</Label>
                  <input
                    className="w-full border p-2 rounded"
                    value={reauthCriteriaFields.rnWorkedWithEmployeeLength}
                    onChange={(e) => setReauthCriteriaFields((p) => ({ ...p, rnWorkedWithEmployeeLength: e.target.value }))}
                  />
                </div>

                <div>
                  <Label>Document method of training/delegating task of administering insulin, including rationale:</Label>
                  <textarea
                    className="w-full border p-2 rounded h-24"
                    value={reauthCriteriaFields.trainingMethodAndRationale}
                    onChange={(e) => setReauthCriteriaFields((p) => ({ ...p, trainingMethodAndRationale: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Length of time employee has given insulin (within your community):</Label>
                    <input
                      className="w-full border p-2 rounded"
                      value={reauthCriteriaFields.insulinExperienceCommunity}
                      onChange={(e) => setReauthCriteriaFields((p) => ({ ...p, insulinExperienceCommunity: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Length of time employee has given insulin (total within career):</Label>
                    <input
                      className="w-full border p-2 rounded"
                      value={reauthCriteriaFields.insulinExperienceCareer}
                      onChange={(e) => setReauthCriteriaFields((p) => ({ ...p, insulinExperienceCareer: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <Label>
                    Length of time the employee has worked directly with the Resident being delegated and knowledge level of individualized signs and symptoms of hyper/hypoglycemia of this resident.
                  </Label>
                  <textarea
                    className="w-full border p-2 rounded h-24"
                    value={reauthCriteriaFields.residentWorkAndKnowledge}
                    onChange={(e) => setReauthCriteriaFields((p) => ({ ...p, residentWorkAndKnowledge: e.target.value }))}
                  />
                </div>

                <div>
                  <Label>Describe the willingness of the Unlicensed Professional to conduct the delegated task.</Label>
                  <textarea
                    className="w-full border p-2 rounded h-20"
                    value={reauthCriteriaFields.willingnessDescription}
                    onChange={(e) => setReauthCriteriaFields((p) => ({ ...p, willingnessDescription: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        title="Rescind"
        open={showRescindModal}
        onClose={() => setShowRescindModal(false)}
        footer={
          <Button variant="danger" onClick={confirmRescind}>
            Confirm
          </Button>
        }
      >
        <div>
          <Label>Reason</Label>
          <textarea className="w-full border p-2 rounded" value={rescindReason} onChange={(e) => setRescindReason(e.target.value)} />
        </div>
      </Modal>

      <Modal
        title="Log Personal Observation"
        open={showSupervisionModal}
        onClose={() => setShowSupervisionModal(false)}
        footer={<Button onClick={saveSupervisionLog}>Save</Button>}
      >
        <div className="grid grid-cols-2 gap-2">
          {Object.keys(supervisionData.methods).map((k) => (
            <Checkbox
              key={k}
              label={k.replace(/([A-Z])/g, " $1").trim()}
              checked={supervisionData.methods[k]}
              onChange={(v) => setSupervisionData((p) => ({ ...p, methods: { ...p.methods, [k]: v } }))}
            />
          ))}
        </div>
      </Modal>

      <Modal
        title="Resident Profile"
        open={!!viewResidentId}
        onClose={() => setViewResidentId(null)}
        footer={
          <div className="flex justify-end gap-2">
            {isEditingResident ? (
              <>
                <Button variant="secondary" onClick={handleCancelEditResident}>
                  Cancel
                </Button>
                <Button onClick={handleSaveResidentChanges}>
                  <Save size={16} /> Save
                </Button>
              </>
            ) : (
              <Button variant="secondary" onClick={() => setViewResidentId(null)}>
                Close
              </Button>
            )}
          </div>
        }
      >
        {viewingResident && (
          <div className="space-y-4">
            <div className="flex justify-between items-start border-b pb-4">
              <div>
                {isEditingResident ? (
                  <div className="space-y-2 mb-2">
                    <input
                      className="text-xl font-bold border-b w-full"
                      value={editResidentForm.name}
                      onChange={(e) => setEditResidentForm({ ...editResidentForm, name: e.target.value })}
                    />
                    <div className="flex gap-2 text-sm items-center">
                      <span>Unit:</span>
                      <input
                        className="border rounded px-1 w-16"
                        value={editResidentForm.unit}
                        onChange={(e) => setEditResidentForm({ ...editResidentForm, unit: e.target.value })}
                      />
                      <span>DOB:</span>
                      <input
                        type="date"
                        className="border rounded px-1"
                        value={editResidentForm.dob}
                        onChange={(e) => setEditResidentForm({ ...editResidentForm, dob: e.target.value })}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <h2 className="text-xl font-bold">{viewingResident.name}</h2>
                    <div className="text-sm text-gray-500">
                      Unit: {viewingResident.unit} • DOB: {viewingResident.dob}
                    </div>
                  </>
                )}
              </div>
              <div className="flex gap-2 items-center">
                {renderNextAssessmentBadge(viewingResident)}
                {!isEditingResident && (
                  <Button variant="secondary" size="sm" onClick={handleEditResidentClick} title="Edit">
                    <Edit2 size={14} /> Edit
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={() => openAssessmentModal(viewingResident.id)}>
                  <Plus size={14} /> New Assessment
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="border p-2 rounded">
                <b>Diagnosis:</b>{" "}
                {isEditingResident ? (
                  <textarea
                    className="w-full border rounded p-1"
                    value={editResidentForm.diagnosis}
                    onChange={(e) => setEditResidentForm({ ...editResidentForm, diagnosis: e.target.value })}
                  />
                ) : (
                  viewingResident.diagnosis
                )}
              </div>
              <div className="border p-2 rounded">
                <b>Regimen:</b>{" "}
                {isEditingResident ? (
                  <textarea
                    className="w-full border rounded p-1"
                    value={editResidentForm.regimen}
                    onChange={(e) => setEditResidentForm({ ...editResidentForm, regimen: e.target.value })}
                  />
                ) : (
                  viewingResident.regimen
                )}
              </div>
            </div>

            <h3 className="font-bold mt-4">Assessments</h3>
            <div className="border rounded overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2">Date</th>
                    <th className="p-2">Type</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Print</th>
                  </tr>
                </thead>
                <tbody>
                  {(viewingResident.assessments || []).map((a, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{formatDate(a.date)}</td>
                      <td className="p-2">{a.type}</td>
                      <td className="p-2">{a.stable ? "Stable" : "Unstable"}</td>
                      <td className="p-2">
                        <Button variant="ghost" onClick={() => printAssessment({ orgName: activeCommunity.name, resident: viewingResident, assessment: a })}>
                          <Printer size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="font-bold mt-4">Delegated Med-Techs</h3>
            <div className="border rounded overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2">Med-Tech</th>
                    <th className="p-2">Task</th>
                    <th className="p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {viewingResidentDelegations.map((d) => {
                    const m = medTechs.find((x) => x.id === d.medTechId);
                    const t = DELEGATION_TASKS.find((x) => x.id === d.taskId);
                    return (
                      <tr key={d.id} className="border-t">
                        <td className="p-2">{m?.name}</td>
                        <td className="p-2">{t?.label}</td>
                        <td className="p-2 flex gap-1 flex-wrap">
                          <Button variant="secondary" onClick={() => handlePrintDelegation(d)} className="text-xs h-auto py-1" title="Print Packet">
                            <Printer size={14} /> Print Packet
                          </Button>
                          <Button variant="secondary" onClick={() => openSign(d.id)} className="text-xs h-auto py-1" title="Sign">
                            <PenLine size={14} /> Sign
                          </Button>
                          <Button variant="secondary" onClick={() => handlePrintDelegation(d)} className="text-xs h-auto py-1" title="Print">
                            <Printer size={14} /> Print
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title="Log Diabetic/Condition Assessment"
        open={showAssessmentModal}
        onClose={() => setShowAssessmentModal(false)}
        footer={<Button onClick={saveAssessment}>Save</Button>}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Assessment Date</Label>
              <input
                type="date"
                className="w-full border p-2 rounded"
                value={assessmentForm.date}
                onChange={(e) => updateAssessmentForm("date", e.target.value)}
              />
            </div>
            <div>
              <Label>Type</Label>
              <select
                className="w-full border p-2 rounded"
                value={assessmentForm.type}
                onChange={(e) => updateAssessmentForm("type", e.target.value)}
              >
                <option>Quarterly</option>
                <option>Initial</option>
                <option>Change of Condition</option>
              </select>
            </div>
          </div>
          <div className="p-2 bg-gray-50 border rounded">
            <Label>Next Due Date</Label>
            <div className="flex gap-2 items-center">
              <input
                type="date"
                className="border p-1 rounded"
                value={assessmentForm.nextDueDate}
                onChange={(e) => setAssessmentForm({ ...assessmentForm, nextDueDate: e.target.value })}
              />
              <span className="text-xs text-gray-500">
                {assessmentForm.type === "Change of Condition" ? "Manually set date" : "Auto-calculated (90 days)"}
              </span>
            </div>
          </div>
          <div>
            <Label>RN Determination</Label>
            <div className="flex gap-4">
              <label>
                <input type="radio" checked={assessmentForm.stable} onChange={() => setAssessmentForm({ ...assessmentForm, stable: true })} /> Stable & Predictable (Safe to delegate)
              </label>
              <label>
                <input type="radio" checked={!assessmentForm.stable} onChange={() => setAssessmentForm({ ...assessmentForm, stable: false })} /> Unstable / Unpredictable
              </label>
            </div>
          </div>
          <div>
            <Label>RN Diabetic Assessment (Narrative)</Label>
            <textarea
              className="w-full border p-2 rounded h-32"
              value={assessmentForm.notes}
              onChange={(e) => setAssessmentForm({ ...assessmentForm, notes: e.target.value })}
            />
          </div>
        </div>
      </Modal>

      <Modal
        title="Training Record"
        open={showTrainingModal}
        onClose={() => setShowTrainingModal(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() =>
                printTranscript({
                  orgName: activeCommunity.name,
                  medTech: medTechs.find((m) => m.id === activeMedTechId),
                })
              }
            >
              <Printer size={16} /> Print
            </Button>
            <Button onClick={saveTraining}>Save</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-left">Topic</th>
                  <th className="p-2 text-left">Notes</th>
                </tr>
              </thead>
              <tbody>
                {(medTechs.find((m) => m.id === activeMedTechId)?.trainingTranscript || []).map((tr, i) => (
                  <tr key={i} className="border-b">
                    <td className="p-2">{formatDate(tr.date)}</td>
                    <td className="p-2">{tr.topic}</td>
                    <td className="p-2 text-gray-500">{tr.notes}</td>
                  </tr>
                ))}
                {!medTechs.find((m) => m.id === activeMedTechId)?.trainingTranscript?.length && (
                  <tr>
                    <td colSpan="3" className="p-4 text-center text-gray-400">
                      No history found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div>
            <Label>Training Notes</Label>
            <textarea className="w-full border p-2 rounded h-40" value={trainingForm} onChange={(e) => setTrainingForm(e.target.value)} />
          </div>
        </div>
      </Modal>

      <Modal
        title="Signatures"
        open={showSignModal}
        onClose={() => setShowSignModal(false)}
        footer={<Button onClick={saveSignatures}>Save</Button>}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Med-Tech Name</Label>
            <input className="w-full border p-2 rounded mb-2" value={signMode.mtTypedName} onChange={(e) => setSignMode({ ...signMode, mtTypedName: e.target.value })} />
            <Checkbox label="Use Drawn" checked={signMode.mtUseDrawn} onChange={(v) => setSignMode({ ...signMode, mtUseDrawn: v })} />
            {signMode.mtUseDrawn && <SignaturePad value={signMode.mtSignatureImage} onChange={(v) => setSignMode({ ...signMode, mtSignatureImage: v })} />}
          </div>
          <div>
            <Label>RN Name</Label>
            <input className="w-full border p-2 rounded mb-2" value={signMode.rnTypedName} onChange={(e) => setSignMode({ ...signMode, rnTypedName: e.target.value })} />
            <Checkbox label="Use Drawn" checked={signMode.rnUseDrawn} onChange={(v) => setSignMode({ ...signMode, rnUseDrawn: v })} />
            {signMode.rnUseDrawn && <SignaturePad value={signMode.rnSignatureImage} onChange={(v) => setSignMode({ ...signMode, rnSignatureImage: v })} />}
          </div>
        </div>
      </Modal>

      <Modal
        title="Add Resident"
        open={showAddResident}
        onClose={() => setShowAddResident(false)}
        footer={<Button onClick={handleAddResident}>Save</Button>}
      >
        <div className="space-y-2">
          <Label>Name</Label>
          <input className="w-full border p-2 rounded" value={residentForm.name} onChange={(e) => setResidentForm({ ...residentForm, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Unit</Label>
              <input className="w-full border p-2 rounded" value={residentForm.unit} onChange={(e) => setResidentForm({ ...residentForm, unit: e.target.value })} />
            </div>
            <div>
              <Label>DOB</Label>
              <input type="date" className="w-full border p-2 rounded" value={residentForm.dob} onChange={(e) => setResidentForm({ ...residentForm, dob: e.target.value })} />
            </div>
          </div>
          <Label>Diagnosis</Label>
          <textarea className="w-full border p-2 rounded" value={residentForm.diagnosis} onChange={(e) => setResidentForm({ ...residentForm, diagnosis: e.target.value })} />
          <Label>Regimen</Label>
          <textarea className="w-full border p-2 rounded" value={residentForm.regimen} onChange={(e) => setResidentForm({ ...residentForm, regimen: e.target.value })} />
        </div>
      </Modal>

      <Modal
        title="Add Med-Tech"
        open={showAddMedTech}
        onClose={() => setShowAddMedTech(false)}
        footer={<Button onClick={handleAddMedTech}>Save</Button>}
      >
        <div className="space-y-2">
          <Label>Name</Label>
          <input className="w-full border p-2 rounded" value={medTechForm.name} onChange={(e) => setMedTechForm({ ...medTechForm, name: e.target.value })} />

          <Label>Community</Label>
          <select
            className="w-full border p-2 rounded"
            value={medTechForm.communityId}
            onChange={(e) => setMedTechForm({ ...medTechForm, communityId: e.target.value })}
          >
            {communities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <Label>Experience</Label>
          <textarea className="w-full border p-2 rounded" value={medTechForm.experience} onChange={(e) => setMedTechForm({ ...medTechForm, experience: e.target.value })} />

          <Label>Training</Label>
          <textarea className="w-full border p-2 rounded" value={medTechForm.training} onChange={(e) => setMedTechForm({ ...medTechForm, training: e.target.value })} />

          {/* This is the "Add Med-Tech menu" justification data that flows into the packet */}
          <div className="bg-gray-50 border rounded-xl p-3 mt-2">
            <div className="font-bold text-gray-900 mb-2">Delegation Profile (Flows into Packet)</div>

            <Label>Length of time RN has worked with employee being delegated:</Label>
            <input
              className="w-full border p-2 rounded mb-2"
              value={medTechForm.delegationProfile.rnWorkedWithEmployeeLength}
              onChange={(e) =>
                setMedTechForm((p) => ({
                  ...p,
                  delegationProfile: { ...p.delegationProfile, rnWorkedWithEmployeeLength: e.target.value },
                }))
              }
            />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Insulin experience (within your community):</Label>
                <input
                  className="w-full border p-2 rounded"
                  value={medTechForm.delegationProfile.insulinExperienceCommunity}
                  onChange={(e) =>
                    setMedTechForm((p) => ({
                      ...p,
                      delegationProfile: { ...p.delegationProfile, insulinExperienceCommunity: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <Label>Insulin experience (total within career):</Label>
                <input
                  className="w-full border p-2 rounded"
                  value={medTechForm.delegationProfile.insulinExperienceCareer}
                  onChange={(e) =>
                    setMedTechForm((p) => ({
                      ...p,
                      delegationProfile: { ...p.delegationProfile, insulinExperienceCareer: e.target.value },
                    }))
                  }
                />
              </div>
            </div>

            <div className="mt-2">
              <Label>Describe willingness of the Unlicensed Professional to conduct delegated tasks.</Label>
              <textarea
                className="w-full border p-2 rounded h-20"
                value={medTechForm.delegationProfile.willingnessDescription}
                onChange={(e) =>
                  setMedTechForm((p) => ({
                    ...p,
                    delegationProfile: { ...p.delegationProfile, willingnessDescription: e.target.value },
                  }))
                }
              />
            </div>

            <div className="text-xs text-gray-500 mt-1">
              Note: Resident-specific knowledge is entered per delegation (not here).
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        title="Edit Community"
        open={!!editingCommunityId}
        onClose={() => setEditingCommunityId(null)}
        footer={<Button onClick={saveCommunity}>Save</Button>}
      >
        {editCommunityForm && (
          <div className="space-y-4">
            <h3 className="font-bold">Admin</h3>
            <input
              className="w-full border p-2 rounded"
              placeholder="Name"
              value={editCommunityForm.admin.name}
              onChange={(e) => setEditCommunityForm({ ...editCommunityForm, admin: { ...editCommunityForm.admin, name: e.target.value } })}
            />
            <input
              className="w-full border p-2 rounded"
              placeholder="Email"
              value={editCommunityForm.admin.email}
              onChange={(e) => setEditCommunityForm({ ...editCommunityForm, admin: { ...editCommunityForm.admin, email: e.target.value } })}
            />
            <h3 className="font-bold">RN</h3>
            <input
              className="w-full border p-2 rounded"
              placeholder="Name"
              value={editCommunityForm.rn.name}
              onChange={(e) => setEditCommunityForm({ ...editCommunityForm, rn: { ...editCommunityForm.rn, name: e.target.value } })}
            />
            <input
              className="w-full border p-2 rounded"
              placeholder="Email"
              value={editCommunityForm.rn.email}
              onChange={(e) => setEditCommunityForm({ ...editCommunityForm, rn: { ...editCommunityForm.rn, email: e.target.value } })}
            />
            <h3 className="font-bold">Notifications</h3>
            <input
              className="w-full border p-2 rounded"
              placeholder="Regional Ops Email"
              value={editCommunityForm.notifications.regionalOps}
              onChange={(e) =>
                setEditCommunityForm({ ...editCommunityForm, notifications: { ...editCommunityForm.notifications, regionalOps: e.target.value } })
              }
            />
          </div>
        )}
      </Modal>

      <Modal
        title="Med-Tech Supervision"
        open={showMtSupervisionModal}
        onClose={() => setShowMtSupervisionModal(false)}
        footer={<Button onClick={saveMtSupervision}>Save</Button>}
      >
        <div className="space-y-2">
          <Label>Date</Label>
          <input type="date" className="w-full border p-2 rounded" value={mtSupervisionForm.date} onChange={(e) => setMtSupervisionForm({ ...mtSupervisionForm, date: e.target.value })} />
          <Label>Notes</Label>
          <textarea className="w-full border p-2 rounded h-32" value={mtSupervisionForm.notes} onChange={(e) => setMtSupervisionForm({ ...mtSupervisionForm, notes: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}
