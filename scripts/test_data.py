import collections, gzip, hashlib, itertools, json, re, unittest
from pathlib import Path
from build_data import classify, doi
WEB=Path(__file__).resolve().parents[1]
ROOT=WEB.parent
def read(p):return json.loads(p.read_text())
class DataTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.a=read(WEB/'public/data/atlas.json');cls.source=read(ROOT/'data/curated/metadata.json');cls.refs=read(ROOT/'data/curated/references.json');cls.pm={p['id']:p for p in cls.a['articles']};cls.rs={r['id']:r for r in cls.a['researchers']};cls.original={p['id']:p for p in cls.source}
 def test_source_preserved(self):
  expected={'metadata.json':'a1c1f9f8001036046940e3ca637c1e7819e8de8a4088a15e25750d027b8ea5fe','references.json':'351ac17fc940fbb61ba87e75fff23ee00913b28f20851b7008e40cf6e18239d2'}
  for f,h in expected.items():self.assertEqual(hashlib.sha256((ROOT/'data/curated'/f).read_bytes()).hexdigest(),h)
 def test_article_and_occurrence_conservation(self):
  self.assertEqual(len(self.pm),1168);self.assertEqual(set(self.pm),set(self.original))
  expected={f"{p['id']}#{i}" for p in self.source for i in range(1,len(p['authors'])+1)}
  occurrences=[o for r in self.rs.values() for o in r['occurrences']]
  self.assertEqual(len(occurrences),2771);self.assertEqual(set(occurrences),expected);self.assertEqual(len(occurrences),len(set(occurrences)))
  mapping={o:r['id'] for r in self.rs.values() for o in r['occurrences']}
  for p in self.source:self.assertEqual(set(self.pm[p['id']]['authors']),{mapping[f"{p['id']}#{i}"] for i in range(1,len(p['authors'])+1)})
 def test_coauthor_counts_independent(self):
  expected=collections.defaultdict(set)
  for p in self.pm.values():
   for pair in itertools.combinations(sorted(set(p['authors'])),2):expected[pair].add(p['id'])
  actual={(e['source'],e['target']):set(e['articles']) for e in self.a['coauthors']}
  self.assertEqual(actual,dict(expected));self.assertEqual(len(actual),len(self.a['coauthors']))
 def test_reference_join_independent(self):
  ki={p['kci_id']:p['id'] for p in self.source if p['kci_id']};ds=collections.defaultdict(set);expected=set()
  for p in self.source:
   if doi(p['doi']):ds[doi(p['doi'])].add(p['id'])
  for r in self.refs:
   tid=ki.get(r['source_attributes'].get('arti-id'));targets=ds.get(doi(r['fields'].get('doi')),set())
   if tid and targets and tid not in targets:continue
   if not tid and len(targets)==1:tid=next(iter(targets))
   if tid:expected.add((r['citing_id'],tid))
  actual={(e['source'],e['target']) for e in self.a['citations']}
  self.assertEqual(expected,actual);self.assertEqual(len(actual),1260)
  for s,t in actual:self.assertIn(s,self.pm);self.assertIn(t,self.pm)
 def test_missing_is_not_zero(self):
  refcounts=collections.Counter(r['citing_id'] for r in self.refs)
  for p in self.pm.values():
   self.assertEqual(p['referenceCount'],refcounts.get(p['id']))
   if not self.original[p['id']]['citations']:self.assertIsNone(p['kciCitations'])
  self.assertEqual(sum(p['kciCitations'] is None for p in self.pm.values()),92)
 def test_details_and_evidence(self):
  total=0
  for p in self.pm.values():
   d=read(WEB/'public/data/articles'/f"{p['id'].replace(':','_')}.json")
   for k,v in p.items():self.assertEqual(d[k],v)
   original=self.original[p['id']]
   fields={'title':[original['title']],'keyword':[x['value'] for x in original['keywords']],'abstract':[x['value'] for x in original['abstracts']]}
   for tag in d['tags']:
    self.assertTrue(tag['evidence']);total+=1
    for e in tag['evidence']:
     self.assertTrue(any(e['quote'] in s for s in fields[e['field']]))
     self.assertIn(e['term'],e['quote'])
   self.assertTrue(d['url'].startswith(('https://','http://')))
  self.assertGreater(total,1000)
 def test_classification_boundaries(self):
  tax=read(WEB/'config/taxonomy.json')
  def tags(title,abstract=''):
   return {t['id'] for t in classify({'title':title,'keywords':[],'abstracts':[{'value':abstract}]},tax)}
  self.assertNotIn('p-ai',tags('Training and learning in higher education'))
  self.assertNotIn('online',tags('What Makes a Mobile Learning Game Enjoyable?'))
  self.assertNotIn('p-teacher',tags('교사, 교육공학 전문가와 면접을 실시했다'))
  self.assertIn('p-teacher',tags('예비교사의 디지털 역량 함양을 위한 프로그램'))
  self.assertIn('p-ai',tags('생성형 AI를 활용한 수업 설계'))
  self.assertIn('p-equity',tags('디지털 격차와 장애학생의 학습 접근성'))
  self.assertNotIn('p-teacher',tags('이러닝에서 학습자의 만족도'))
  self.assertNotIn('online',tags('학습 결과 분석','이러닝의 사례도 있다.'))
 def test_public_schema_and_size(self):
  bad={'raw_file','source_file','correction_evidence_file','api_key','apikey','token'}
  def visit(x):
   if isinstance(x,dict):
    self.assertFalse(bad&set(x))
    for v in x.values():visit(v)
   elif isinstance(x,list):
    for v in x:visit(v)
  visit(self.a)
  self.assertLess(len(gzip.compress((WEB/'public/data/atlas.json').read_bytes())),2_000_000)
 def test_layout_and_identity(self):
  for r in self.rs.values():
   self.assertEqual(r['identityStatus'],'provisional');self.assertIn(r['id'],self.a['positions']['authors'])
   for p in r['articles']:self.assertIn(r['id'],self.pm[p]['authors'])
  for p in self.pm:self.assertIn(p,self.a['positions']['citations'])
  for mode in self.a['positions'].values():
   for pos in mode.values():self.assertTrue(all(isinstance(n,(float,int)) and abs(n)<1e9 for n in pos))
if __name__=='__main__':unittest.main(verbosity=2)
