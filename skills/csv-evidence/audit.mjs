// Toyol CSV evidence checker: no network, no persistence, no external data.
export const MAX_BYTES=131072, MAX_ROWS=2000, MAX_COLUMNS=100, MAX_FINDINGS=100;
export function parseCsv(input) {
  if(typeof input!=="string"||new TextEncoder().encode(input).length>MAX_BYTES)throw new Error("CSV must be a string, maximum 128 KiB");
  let s=input.replace(/^\uFEFF/,""),rows=[],row=[],field="",state=0;
  function cell(){if(row.length>=MAX_COLUMNS)throw new Error("Column limit exceeded");row.push(field);field="";state=0;}
  function finish(){cell();if(rows.length>=MAX_ROWS+1)throw new Error("Row limit exceeded");rows.push(row);row=[];}
  for(let i=0;i<s.length;i++){
    const c=s[i];
    if(state===2){if(c==='"'){if(s[i+1]==='"'){field+='"';i++;}else state=3;}else field+=c;continue;}
    if(c===","){cell();continue;}
    if(c==="\n"||c==="\r"){if(c==="\r"&&s[i+1]==="\n")i++;finish();continue;}
    if(state===3)throw new Error("Unexpected text after closing quote at character "+(i+1));
    if(c==='"'){if(state!==0)throw new Error("Unexpected quote at character "+(i+1));state=2;}
    else{field+=c;state=1;}
  }
  if(state===2)throw new Error("Unclosed quoted field");
  if(row.length||field.length||state!==0||s.endsWith(","))finish();
  return rows;
}
export async function auditCsv(csv,{required=[],unique=[]}={}){
  if(!Array.isArray(required)||!Array.isArray(unique)||[...required,...unique].some(x=>typeof x!=="string"||x.length>256)||required.length>100||unique.length>100)throw new Error("required and unique must be bounded arrays of column names");
  const rows=parseCsv(csv);if(!rows.length)throw new Error("CSV has no header");
  const [headers,...data]=rows,findings=[],counts={};let total=0;
  const add=(code,info)=>{counts[code]=(counts[code]??0)+1;total++;if(findings.length<MAX_FINDINGS)findings.push({code,...info});};
  let indexes=new Map();
  headers.forEach((h,i)=>{if(!h.trim())add("EMPTY_HEADER",{column:i+1});if(indexes.has(h))add("DUPLICATE_HEADER",{column:i+1,firstColumn:indexes.get(h)+1});else indexes.set(h,i);});
  for(const col of new Set([...required,...unique]))if(!indexes.has(col))add("UNKNOWN_RULE_COLUMN",{column:col});
  const seenRows=new Map(),seenCols=new Map([...new Set(unique)].filter(x=>indexes.has(x)).map(x=>[x,new Map()]));
  let blanks=0;
  data.forEach((r,i)=>{
    const record=i+2;
    if(r.every(x=>!x.trim())){blanks++;add("EMPTY_RECORD",{record});}
    if(r.length!==headers.length)add("ROW_WIDTH",{record,expected:headers.length,actual:r.length});
    const key=JSON.stringify(r);
    if(seenRows.has(key))add("DUPLICATE_RECORD",{record,firstRecord:seenRows.get(key)});else seenRows.set(key,record);
    for(const c of new Set(required)){if(indexes.has(c)&&!(r[indexes.get(c)]??"").trim())add("MISSING_REQUIRED",{record,column:c});}
    for(const [c,seen] of seenCols){const value=r[indexes.get(c)];if(value===undefined||!value.trim())continue;if(seen.has(value))add("DUPLICATE_VALUE",{record,column:c,firstRecord:seen.get(value)});else seen.set(value,record);}
  });
  const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(csv));
  return {schema:"toyol.csv-evidence.v1",sha256:Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,"0")).join(""),records:data.length,columns:headers.length,blankRecords:blanks,pass:total===0,totalFindings:total,counts,findings,truncated:total>findings.length,recordNumbering:"1-based CSV records including header, not physical lines"};
}
