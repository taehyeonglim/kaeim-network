"""Build a public, reproducible projection; never mutate the curated sources."""
import argparse, collections, hashlib, itertools, json, re
from pathlib import Path

WEB = Path(__file__).resolve().parents[1]
ROOT = WEB.parent
def read(p): return json.loads(p.read_text())
def write(p, value):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':'))+'\n')
def norm(s): return re.sub(r'\s+', '', (s or '')).casefold()
def english(s): return ''.join(sorted(re.findall(r'[a-z]+', (s or '').lower())))
def doi(s): return re.sub(r'^(?:https?://(?:dx\.)?doi\.org/|doi:\s*)', '', (s or '').strip(),flags=re.I).lower().rstrip('.')
def digest(s): return hashlib.sha256(s.encode()).hexdigest()[:14]
def classify(p, taxonomy):
    fields=[('title',p['title'])]+[('keyword',x['value']) for x in p['keywords'] if x.get('value')]+[('abstract',x['value']) for x in p['abstracts'] if x.get('value')]
    out=[]
    for kind, key in [('topic','topics'),('policy','policies')]:
        for tag in taxonomy[key]:
            matches=[]
            for field,text in fields:
                for pattern in tag['patterns']:
                    match=re.search(pattern,text,re.I)
                    if match:
                        a,b=match.span()
                        matches.append({'field':field,'quote':text[max(0,a-45):min(len(text),b+60)],'term':match.group(),'rule':pattern})
            strong=[x for x in matches if x['field']!='abstract']
            # Abstract-only academic labels require two different cues, not a lone mention.
            if strong or (kind=='topic' and len({x['rule'] for x in matches})>=2) or (kind=='policy' and matches):
                chosen=(strong or matches)[:3]
                out.append({'id':tag['id'],'kind':kind,'method':'rule-based','status':'inferred','evidence':chosen})
    return out

def build(source=ROOT/'data/curated', out=WEB/'public/data'):
    articles=read(source/'metadata.json'); references=read(source/'references.json')
    taxonomy=read(WEB/'config/taxonomy.json'); overrides=read(WEB/'config/identity-overrides.json')
    occ=[]; bases=collections.defaultdict(set)
    for p in articles:
        for i,a in enumerate(p['authors'],1):
            inst=re.sub(r'\s+',' ',a.get('institution') or '').strip()
            inst=overrides['institutionAliases'].get(inst,inst)
            name=re.sub(r'\s+',' ',a.get('name') or '').strip()
            oid=f"{p['id']}#{i}"
            base=norm(name)+'|'+norm(inst) if name and inst else oid
            eng=english(a.get('english_name'))
            if eng:bases[base].add(eng)
            occ.append({'id':oid,'articleId':p['id'],'position':i,'name':name or '이름 미상','institution':inst,'englishName':a.get('english_name') or '', 'base':base,'eng':eng,'year':int(p['year'])})
    researchers={}; by_article=collections.defaultdict(list)
    for o in occ:
        key=o['base']+('|' + (o['eng'] or 'unknown') if len(bases[o['base']])>1 else '')
        rid='r-'+digest(key); override=overrides['assignments'].get(o['id'])
        if override:
            assert override.get('evidence') and override.get('researcherId'), 'Override requires evidence'
            rid=override['researcherId']
        rec=researchers.setdefault(rid,{'id':rid,'name':o['name'],'institutions':set(),'englishNames':set(),'articles':set(),'occurrences':[],'identityStatus':'reviewed' if override else 'provisional'})
        if o['institution']:rec['institutions'].add(o['institution'])
        if o['englishName']:rec['englishNames'].add(o['englishName'])
        rec['articles'].add(o['articleId']);rec['occurrences'].append(o['id'])
        o['researcherId']=rid; by_article[o['articleId']].append(rid)
    name_groups=collections.defaultdict(list)
    for r in researchers.values():name_groups[norm(r['name'])].append(r['id'])
    for r in researchers.values():
        r['sameNameIds']=[x for x in name_groups[norm(r['name'])] if x!=r['id']]
        for k in ['institutions','englishNames','articles']:r[k]=sorted(r[k])
    paper_map={p['id']:p for p in articles}; kci={p['kci_id']:p['id'] for p in articles if p['kci_id']}
    dois=collections.defaultdict(set)
    for p in articles:
        if doi(p['doi']):dois[doi(p['doi'])].add(p['id'])
    edge_map={}; ref_counts=collections.Counter(); conflict=[]; direct_count=0
    for ref in references:
        source_id=ref['citing_id'];ref_counts[source_id]+=1
        target=kci.get(ref['source_attributes'].get('arti-id')); method='kci-id'
        ds=dois.get(doi(ref['fields'].get('doi')),set())
        if target and ds and target not in ds:
            conflict.append(ref['id']);continue
        if not target and len(ds)==1:target=next(iter(ds));method='doi'
        if target:
            if method=='kci-id':direct_count+=1
            key=(source_id,target)
            e=edge_map.setdefault(key,{'source':source_id,'target':target,'methods':[],'referenceIds':[]})
            if method not in e['methods']:e['methods'].append(method)
            e['referenceIds'].append(ref['id'])
    citations=sorted(edge_map.values(),key=lambda e:(e['source'],e['target']))
    incoming=collections.Counter(e['target'] for e in citations)
    coauthors={}; summaries=[]; classifications=[]
    for p in articles:
        aids=list(dict.fromkeys(by_article[p['id']]))
        for a,b in itertools.combinations(sorted(aids),2):
            coauthors.setdefault((a,b),[]).append(p['id'])
        tags=classify(p,taxonomy);classifications.extend({'articleId':p['id'],**t} for t in tags)
        vals=[c.get('kci') for c in p['citations'] if c.get('kci') is not None]
        citation=int(vals[0]) if vals and str(vals[0]).isdigit() else None
        summary={'id':p['id'],'title':p['title'],'year':int(p['year']),'month':int(p['month'] or 1),'authors':aids,'topics':[t['id'] for t in tags if t['kind']=='topic'],'policies':[t['id'] for t in tags if t['kind']=='policy'],'keywords':list(dict.fromkeys(x['value'] for x in p['keywords'] if x.get('value'))),'kciCitations':citation,'internalCitations':incoming[p['id']],'referenceCount':ref_counts.get(p['id']), 'source':p['provenance']['source']}
        summaries.append(summary)
        detail={**summary,'authorsDetail':[{'id':rid,'name':a['name'],'institution':a.get('institution') or None,'englishName':a.get('english_name') or None} for a,rid in zip(p['authors'],by_article[p['id']])], 'abstracts':[{'lang':a.get('lang','original'),'value':a['value']} for a in p['abstracts'] if a.get('value')],'doi':p['doi'] or None,'url':p['url'],'volume':p['volume'],'issue':p['issue'],'pages':f"{p['first_page']}–{p['last_page']}",'tags':tags}
        write(out/'articles'/f"{p['id'].replace(':','_')}.json",detail)
    hashes={name:hashlib.sha256((source/name).read_bytes()).hexdigest() for name in ['metadata.json','references.json']}
    config_hashes={name:hashlib.sha256((WEB/'config'/name).read_bytes()).hexdigest() for name in ['taxonomy.json','identity-overrides.json']}
    version=digest(json.dumps([hashes,config_hashes],sort_keys=True))
    meta={'version':version,'metadataAsOf':'2026-11-13','inventoryAsOf':'2026-11-15','minYear':min(p['year'] for p in summaries),'maxYear':max(p['year'] for p in summaries),'articleCount':len(articles),'authorOccurrences':len(occ),'researcherGroups':len(researchers),'referenceOccurrences':len(references),'papersWithReferences':len(ref_counts),'internalEdges':len(citations),'directIdReferences':direct_count,'unresolvedCitationConflicts':len(conflict),'missingPeriods':['창간호','1995년','1997년'],'unclassifiedArticles':sum(not p['topics'] for p in summaries),'identityNote':'이름·논문 당시 소속 기준의 임시 연구자 묶음입니다. 실제 인원·회원 수가 아닙니다.','sourceHashes':hashes,'configHashes':config_hashes}
    payload={'meta':meta,'taxonomy':{k:[{a:b for a,b in t.items() if a!='patterns'} for t in taxonomy[k]] for k in ['topics','policies']},'researchers':sorted(researchers.values(),key=lambda r:r['id']),'articles':sorted(summaries,key=lambda p:p['id']),'coauthors':[{'source':a,'target':b,'articles':sorted(ps)} for (a,b),ps in sorted(coauthors.items())],'citations':citations}
    write(out/'atlas.json',payload)
    write(WEB/'docs/data-build.json',{'meta':meta,'citationConflicts':conflict,'classificationCounts':dict(collections.Counter(t['id'] for t in classifications)),'identityOverrides':len(overrides['assignments']),'unmatchedOverrides':sorted(set(overrides['assignments'])-{o['id'] for o in occ})})
    print(json.dumps(meta,ensure_ascii=False,indent=2))
    return payload,occ

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--source',type=Path,default=ROOT/'data/curated');parser.add_argument('--out',type=Path,default=WEB/'public/data');args=parser.parse_args()
    build(args.source,args.out)
