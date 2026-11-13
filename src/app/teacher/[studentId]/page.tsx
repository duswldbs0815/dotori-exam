import { Suspense } from "react";
import { TeacherReport } from "@/components/teacher/TeacherReport";
import { Loading } from "@/components/ui";

export default function TeacherStudentPage() {
  return (
    <Suspense fallback={<Loading label="리포트를 불러오는 중" />}>
      <TeacherReport />
    </Suspense>
  );
}
