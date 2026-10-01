import { Suspense } from "react";
import VocabularyScreen from "@/components/screens/VocabularyScreen";

export default function VocabularyPage() {
  return (
    <Suspense>
      <VocabularyScreen />
    </Suspense>
  );
}
