import { MapIcon } from "@/components/icons";
import { WorkInProgress } from "@/components/work-in-progress";

export default function MapPage() {
  return (
    <div className="flex flex-col gap-section">
      <h1 className="page-title">Carte</h1>
      <WorkInProgress
        title="La carte arrive bientôt"
        description="Nous construisons la carte de l'application. Elle te permettra de suivre la manifestation en direct."
        icon={<MapIcon />}
        upcoming={[
          "Tracé des déplacements",
          "Position actuelle de la manifestation",
          "Édition du tracé par les gérants",
        ]}
      />
    </div>
  );
}
