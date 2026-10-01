import { Suspense } from "react";
import MissionDetailScreen from "@/components/screens/MissionDetailScreen";

export default async function MissionDetailPage({
  params,
}: {
  params: Promise<{ missionId: string }>;
}) {
  const { missionId } = await params;
  return (
    <Suspense>
      <MissionDetailScreen missionId={missionId} />
    </Suspense>
  );
}
