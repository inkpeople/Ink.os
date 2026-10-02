const fs=require('fs');
const p='android/app/src/main/AndroidManifest.xml';
let s=fs.readFileSync(p,'utf8');
['POST_NOTIFICATIONS','SCHEDULE_EXACT_ALARM','USE_EXACT_ALARM','RECEIVE_BOOT_COMPLETED','VIBRATE','CAMERA'].forEach(x=>{
  if(!s.includes('android.permission.'+x)) s=s.replace('<application','<uses-permission android:name="android.permission.'+x+'" />\n    <application');
});
fs.writeFileSync(p,'<?xml version="1.0" encoding="utf-8"?>\n'+s.replace(/^<\?xml[^>]*>\s*/,''));
console.log('Manifest patched');