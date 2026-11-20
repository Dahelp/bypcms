export type EstimateService = {slug:string; amountMinor:number; billing:"once"|"monthly"};

/** Services are an estimate; the server's confirmed license quote stays separate. */
export function estimateBuild(licenseMinor:number, catalog:readonly EstimateService[], selected:readonly string[]) {
  const keys=new Set(selected);
  const services=catalog.filter(service=>keys.has(service.slug));
  const oneTimeMinor=services.filter(service=>service.billing==="once").reduce((sum,service)=>sum+service.amountMinor,0);
  const monthlyMinor=services.filter(service=>service.billing==="monthly").reduce((sum,service)=>sum+service.amountMinor,0);
  return {licenseMinor,oneTimeMinor,monthlyMinor,initialMinor:licenseMinor+oneTimeMinor+monthlyMinor,hasServices:services.length>0};
}
