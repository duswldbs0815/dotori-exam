import { Suspense } from "react";
import { ExamApp } from "@/components/student/ExamApp";
import { Loading } from "@/components/ui";

export default function ExamPage() {
  return (
    <Suspense fallback={<Loading label="시험지를 펴는 중" />}>
      <ExamApp />
    </Suspense>
  );
}
