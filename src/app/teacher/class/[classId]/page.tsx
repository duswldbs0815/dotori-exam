import { Suspense } from "react";
import { ClassView } from "@/components/teacher/ClassView";
import { Loading } from "@/components/ui";

export default function TeacherClassPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ClassView />
    </Suspense>
  );
}
