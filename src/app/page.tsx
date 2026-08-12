import { NovaApp } from "@/components/nova/NovaApp";
import { ServiceWorkerRegister } from "@/components/nova/ServiceWorkerRegister";

export default function Page() {
  return (
    <>
      <NovaApp />
      <ServiceWorkerRegister />
    </>
  );
}
