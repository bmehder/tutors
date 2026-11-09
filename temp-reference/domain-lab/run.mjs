import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdirSync,renameSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('.',import.meta.url)));
mkdirSync('build',{recursive:true});
execFileSync('elm',['make','tests/Scenarios.elm','--output=build/scenarios.js'],{stdio:'inherit'});
renameSync('build/scenarios.js','build/scenarios.cjs');
const require=createRequire(import.meta.url);
const app=require('./build/scenarios.cjs').Elm.Scenarios.init({flags:null});
app.ports.report.subscribe(results=>{
 for(const result of results) console.log(`${result.passed?'PASS':'FAIL'} ${result.name}`);
 const failed=results.filter(r=>!r.passed);
 console.log(`\n${results.length-failed.length}/${results.length} scenarios passed.`);
 process.exitCode=failed.length?1:0;
});
