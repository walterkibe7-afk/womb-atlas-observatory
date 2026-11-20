import ObservationWizard from "./ObservationWizard";

// The First Observation wizard is rendered entirely from the database.
// Screens, questions, options, routing, signals, and reflection rules all come
// from the form-definition tables (seeded from the Master Screen Register spec).
export const dynamic = "force-dynamic";

export default function ObservationPage() {
  return <ObservationWizard flowKey="first_observation" />;
}
