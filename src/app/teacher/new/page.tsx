import { Suspense } from "react";
import { NewExam } from "@/components/teacher/NewExam";
import { Loading } from "@/components/ui";

export default function NewExamPage() {
  return (
    <Suspense fallback={<Loading />}>
      <NewExam />
    </Suspense>
  );
}
