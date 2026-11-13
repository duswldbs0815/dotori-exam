import { Suspense } from "react";
import { TeacherHome } from "@/components/teacher/TeacherHome";
import { Loading } from "@/components/ui";

export default function TeacherPage() {
  return (
    <Suspense fallback={<Loading />}>
      <TeacherHome />
    </Suspense>
  );
}
