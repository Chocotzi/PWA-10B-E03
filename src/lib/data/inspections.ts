export type InspectionStatus = "ok" | "attention";

export type Inspection = {
  id: string;
  location: string;
  date: string;
  inspector: string;
  status: InspectionStatus;
  statusLabel: string;
  findings: number;
  summary: string;
};

export const inspections: Inspection[] = [
  {
    id: "inspection-001",
    location: "Laboratorio de Redes",
    date: "2026-08-28",
    inspector: "Técnica A",
    status: "ok",
    statusLabel: "Sin incidencias",
    findings: 0,
    summary: "Revisión visual de cableado, ventilación y estaciones de trabajo."
  },
  {
    id: "inspection-002",
    location: "Laboratorio de Electrónica",
    date: "2026-08-27",
    inspector: "Técnico B",
    status: "attention",
    statusLabel: "Requiere atención",
    findings: 2,
    summary: "Se registraron dos observaciones sintéticas para seguimiento de mantenimiento."
  },
  {
    id: "inspection-003",
    location: "Laboratorio de Software",
    date: "2026-08-26",
    inspector: "Técnica C",
    status: "ok",
    statusLabel: "Sin incidencias",
    findings: 0,
    summary: "Comprobación de equipo, señalización y disponibilidad del espacio."
  },
  {
    id: "inspection-004",
    location: "Laboratorio de Redes",
    date: "2026-08-25",
    inspector: "Técnica D",
    status: "attention",
    statusLabel: "Requiere atención",
    findings: 1,
    summary: "Se detectó una observación sintética en la señalización del área de trabajo."
  },
  {
    id: "inspection-005",
    location: "Laboratorio de Electrónica",
    date: "2026-08-24",
    inspector: "Técnico E",
    status: "ok",
    statusLabel: "Sin incidencias",
    findings: 0,
    summary: "Revisión sintética de herramientas, ventilación y orden del espacio."
  },
  {
    id: "inspection-006",
    location: "Laboratorio de Software",
    date: "2026-08-23",
    inspector: "Técnica F",
    status: "attention",
    statusLabel: "Requiere atención",
    findings: 3,
    summary: "Se registraron tres observaciones sintéticas para seguimiento del mantenimiento."
  }
];
