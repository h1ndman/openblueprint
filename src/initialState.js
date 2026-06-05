let counter = 0;
export const uid = (prefix = "id") => `${prefix}_${Date.now().toString(36)}_${(counter++).toString(36)}`;

const PHASE_NAMES = ["Discover", "Onboard", "Use", "Support", "Renew"];

function makePhase(name) {
  return {
    id: uid("phase"),
    name,
    subPhases: [
      { id: uid("sub"), name: "Step 1" },
      { id: uid("sub"), name: "Step 2" },
      { id: uid("sub"), name: "Step 3" },
    ],
  };
}

function makeRow(title) {
  return { id: uid("row"), title, height: 120 };
}

export function createInitialState() {
  return {
    title: "OpenBlueprint",
    cornerLabel: "Actors / Lanes",
    phases: PHASE_NAMES.map(makePhase),
    actorGroups: [
      {
        id: uid("actor"),
        name: "Customer",
        color: "#2563eb",
        rows: [makeRow("Physical Evidence"), makeRow("Customer Actions")],
      },
      {
        id: uid("actor"),
        name: "Frontstage",
        color: "#0ea5e9",
        rows: [makeRow("Frontstage Actions")],
      },
      {
        id: uid("actor"),
        name: "Backstage",
        color: "#0284c7",
        rows: [makeRow("Backstage Actions"), makeRow("Support Processes")],
      },
    ],
    // cells keyed by `${rowId}|${subPhaseId}`
    cells: {},
  };
}
