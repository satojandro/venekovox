/* Offline review harness: real pinned SDK and actual client source, synthetic
 * bridge/dashboard only. No wallet, passport, proof, signature or network. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { test } = require('node:test');
const root = path.resolve(process.env.WP2_REVIEW_ROOT || process.cwd());
const deps = createRequire(process.env.P2_TOOLCHAIN_PACKAGE_JSON || path.join(root, 'apps/front-end/package.json'));
const ts = deps('typescript');
const { ZKPassport, NullifierType } = deps('@zkpassport/sdk');
const sdkDeps = createRequire(deps.resolve('@zkpassport/sdk'));
const { Bridge } = sdkDeps('@obsidion/bridge');
assert.equal(fs.readFileSync(path.join(path.dirname(deps.resolve('@zkpassport/sdk')), '../../package.json'), 'utf8').includes('"version": "0.16.2"'), true);
const source = fs.readFileSync(path.join(root, 'apps/front-end/src/eligibility/request.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exportsObject = {};
new Function('require', 'exports', compiled)(deps, exportsObject);
const html = fs.readFileSync(path.join(root, 'apps/backend/src/trialClient.html'), 'utf8');
const start = html.indexOf('const zk = new ZKPassport(params.domain);');
const end = html.indexOf('const url = done.url;', start);
assert.ok(start >= 0 && end > start, 'trial builder source anchors must exist');
const trial = new Function('ZKPassport', 'NullifierType', 'params', `return (async () => { let sdkReq; ${html.slice(start, end)} return {url:done.url,query:done.query}; })()`);
function decode(url) {
  const parsed = new URL(url);
  const result = Object.fromEntries(parsed.searchParams);
  for (const key of ['c','s']) result[key] = JSON.parse(Buffer.from(result[key], 'base64').toString());
  return result;
}
const params = {
  domain:'uxisnear.com',scope:'venekovox-stage1',validity:604800,
  devMode:false,uniqueIdentifierType:'SALTED',
  queryBuild:{minimumAge:18,nationalityIn:['Australia'],facematch:'strict'},
};
// Only external setup is replaced. request(), done(), domain normalization,
// numeric enum handling, country conversion and URL serialization are REAL SDK.
const realCreate = Bridge.create;
const realFetch = globalThis.fetch;
const realNow = Date.now;
Bridge.create = async () => ({
  connection:{getBridgeId:()=> 'synthetic-review-topic'},getPublicKey:()=> 'synthetic-review-public-key',
  onConnect(){},onSecureChannelEstablished(){},onSecureMessage(){},
});
globalThis.fetch = async (url) => {
  assert.equal(String(url), 'https://dashboard-api.zkpassport.id/public/project?domain=uxisnear.com');
  return {ok:true,status:200,json:async()=>({project:{name:'Review fixture',logoUrl:''},policies:[]})};
};
Date.now = () => 1789066800000;
process.on('exit',()=>{Bridge.create=realCreate;globalThis.fetch=realFetch;Date.now=realNow;});
for (const discloseGender of [false,true]) {
  test(`trial/product request parity, gender=${discloseGender}`,async()=>{
    const p = {...params,queryBuild:{...params.queryBuild,...(discloseGender?{discloseGender:true}:{})}};
    const product = await exportsObject.startZkPassportRequest(p,()=>{throw Error('unexpected proof');},()=>{throw Error('unexpected SDK error');});
    const baseline = await trial(ZKPassport,NullifierType,p);
    assert.deepEqual(product.query,baseline.query);
    assert.deepEqual(decode(product.url),decode(baseline.url));
    const link=decode(product.url);
    assert.equal(link.d,'uxisnear.com');assert.equal(link.dev,'0');assert.equal(link.nt,'1');
    assert.equal(link.v,'0.16.2');assert.equal(link.m,'fast');
    assert.equal(Number(link.dt),Date.now()/1000-604800);
    assert.deepEqual(link.c.nationality,{in:['AUS']});
    assert.equal(link.s.scope,'venekovox-stage1');
    assert.equal(link.c.gender?.disclose,discloseGender?true:undefined);
  });
}
test('SDK supports private age range without birthdate disclosure',()=>{
  const query=new ZKPassport('uxisnear.com').createQuery().range('age',18,29).done().query;
  assert.deepEqual(query,{age:{range:[18,29]}});
});
