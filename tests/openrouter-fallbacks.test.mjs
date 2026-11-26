import test from 'node:test';
import assert from 'node:assert/strict';
import {
 extractFreeTextModels,arrangeFallbacks,isFreeTextChatModel,isOpenRouterModelId
} from '../lib/openrouter-free-utils.ts';
const free=(id,extra={})=>({
 id,name:id,context_length:131072,
 architecture:{input_modalities:['text'],output_modalities:['text']},
 pricing:{prompt:'0',completion:'0',request:'0'},...extra
});
test('free chat parser accepts only exact zero-priced text models',()=>{
 const catalog=[
  free('nvidia/nemotron-3.5-lightning:free'),
  free('google/gemma-4-31b-it:free',{architecture:{input_modalities:['text','image'],output_modalities:['text']}}),
  free('vendor/paid-model',{pricing:{prompt:'0.0005',completion:'0'}}),
  free('vendor/repriced:free',{pricing:{prompt:'0',completion:'0.01'}}),
  free('vendor/request-fee:free',{pricing:{prompt:'0',completion:'0',request:'0.001'}}),
  free('vendor/music:free',{architecture:{input_modalities:['text'],output_modalities:['audio']}}),
  free('vendor/embed:free',{architecture:{input_modalities:['text'],output_modalities:['embeddings']}}),
  free('vendor/dynamic:free',{pricing:{prompt:'-1',completion:'-1'}}),
  free('vendor/tiny:free',{context_length:1000}),
  free('openrouter/free')
 ];
 const eligible=extractFreeTextModels(catalog).map(x=>x.id);
 assert.deepEqual(eligible,['nvidia/nemotron-3.5-lightning:free','google/gemma-4-31b-it:free','openrouter/free']);
});
test('admin ordering, disabled model, and free router last',()=>{
 const ids=['vendor/new-model:free','vendor/fast:free','vendor/other:free','openrouter/free'];
 const ordered=arrangeFallbacks('vendor/selected-primary',ids.map(id=>({id,name:id,context_length:131072})),[
  {model_id:'vendor/fast:free',priority:10,enabled:true},
  {model_id:'vendor/other:free',priority:5,enabled:false},
  {model_id:'openrouter/free',priority:1,enabled:true}
 ]);
 assert.deepEqual(ordered,['vendor/selected-primary','vendor/fast:free','vendor/new-model:free','openrouter/free']);
});
test('deduplicates selected free primary and repeated catalog entries',()=>{
 const c=[free('vendor/a:free'),free('vendor/a:free'),free('vendor/b:free')];
 const eligible=extractFreeTextModels(c);
 assert.equal(eligible.length,2);
 assert.deepEqual(arrangeFallbacks('vendor/a:free',eligible,[]),['vendor/a:free','vendor/b:free']);
});
test('rejects malformed ids and accepts official :free suffix',()=>{
 assert.equal(isOpenRouterModelId('openrouter/free'),true);
 assert.equal(isOpenRouterModelId('google/gemma-4-31b-it:free'),true);
 assert.equal(isOpenRouterModelId('https://malicious.example'),false);
 assert.equal(isOpenRouterModelId('vendor/name; drop table'),false);
 assert.equal(isFreeTextChatModel(free('vendor/not-free')),false);
 assert.throws(()=>extractFreeTextModels(null),/CATALOG_INVALID/);
});
