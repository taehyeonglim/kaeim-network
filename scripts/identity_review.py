"""Apply occurrence-scoped human decisions without changing source metadata."""
from collections import defaultdict, Counter


def apply_review(occurrences, review):
    groups = defaultdict(list)
    for o in occurrences:
        groups[o['researcherId']].append(o)
    parent = {rid: rid for rid in groups}
    status = {}; claims = defaultdict(list); corrections = []; seen = set()

    def find(rid):
        if rid not in parent:
            raise ValueError(f'Unknown reviewed group: {rid}')
        while parent[rid] != rid:
            rid = parent[rid]
        return rid

    def validate_partition(partition):
        ids = partition['existingGroupIds']
        for rid in ids:
            find(rid)
        expected = {o['id'] for rid in ids for o in groups[rid]}
        if expected != set(partition['occurrenceIds']):
            raise ValueError('Reviewed occurrences no longer match source groups')
        return ids

    def scoped_ids(correction, decision):
        ids = correction.get('existingGroupIds', decision['existingGroupIds'])
        for rid in ids:
            find(rid)
        return ids

    allowed = {'merge_all', 'merge_selected', 'merge_selected_keep_distinct',
               'merge_separate_groups', 'keep_all_distinct', 'defer_all', 'correct_name_and_link'}
    decisions = review['decisions']
    for d in decisions:
        if d['name'] in seen or d['decision'] not in allowed:
            raise ValueError('Duplicate name or unsupported identity decision')
        seen.add(d['name'])
        for key in ('existingGroupIds', 'distinctGroupIds', 'deferredGroupIds', 'sourceGroupIds'):
            for rid in d.get(key, []):
                find(rid)
        partitions = d.get('mergeGroups', [d])
        for partition in partitions:
            ids = validate_partition(partition)
            if ids:
                if not d['decision'].startswith('merge_'):
                    raise ValueError('Only an explicit merge decision can combine groups')
                if d['status'] != 'user_confirmed' or not d.get('evidence'):
                    raise ValueError('A merge requires explicit confirmation')
                target = find(ids[0])
                for rid in ids:
                    parent[find(rid)] = target
                    status[rid] = 'reviewed'
        for rid in d.get('distinctGroupIds', []):
            if d['status'] != 'user_confirmed' or not d.get('evidence'):
                raise ValueError('Separation requires explicit confirmation')
            status[rid] = 'reviewed'
        for rid in d.get('deferredGroupIds', []):
            status[rid] = 'pending'
        if d['decision'] == 'correct_name_and_link':
            canonical = next(x for x in decisions if x['name'] == d['linkedDecisionName'])
            if not set(d['sourceGroupIds']) <= set(canonical['existingGroupIds']):
                raise ValueError('Name correction is missing its canonical merge')
        for kind, key in [('name', 'nameCorrections'), ('institution', 'affiliationCorrections')]:
            for c in d.get(key, []):
                corrections.append((kind, c, scoped_ids(c, d)))
        current = d.get('userProvidedCurrentAffiliations', [])
        if d.get('userProvidedCurrentAffiliation'):
            current = current + [d['userProvidedCurrentAffiliation']]
        for claim in current:
            claims[d['existingGroupIds'][0]].append(claim)
        for claim in d.get('distinctGroupCurrentAffiliations', []):
            for rid in claim['existingGroupIds']:
                claims[rid].append(claim)

    distinct = defaultdict(set)
    for d in decisions:
        for pair in d.get('cannotLink', []):
            left, right = find(pair['left']), find(pair['right'])
            if left == right:
                raise ValueError(f"Merge violates confirmed separation: {d['name']}")
            distinct[left].add(right); distinct[right].add(left)
        for rid in d.get('deferredGroupIds', []):
            if sum(find(x) == find(rid) for x in groups) != 1:
                raise ValueError(f"Deferred group was merged: {d['name']}")

    for kind, c, ids in corrections:
        matched = []
        for rid in ids:
            for o in groups[rid]:
                if o[kind] == c['from']:
                    o['originalName' if kind == 'name' else 'originalInstitution'] = o[kind]
                    o[kind] = c['to']; matched.append(o['id'])
        if not matched or (c.get('occurrenceIds') and set(matched) != set(c['occurrenceIds'])):
            raise ValueError(f"Correction no longer matches: {c['from']}")

    info = {}
    for rid, records in groups.items():
        target = find(rid)
        rec = info.setdefault(target, {'identityStatus': status.get(rid, 'provisional'),
                                      'distinctFromIds': sorted(distinct[target]),
                                      'currentAffiliations': []})
        if status.get(rid) == 'reviewed':
            rec['identityStatus'] = 'reviewed'
        for c in claims[rid]:
            claim = {'institution': c['institution'], 'position': c['position'], 'source': 'user_confirmation'}
            if claim not in rec['currentAffiliations']:
                rec['currentAffiliations'].append(claim)
        for o in records:
            o['researcherId'] = target
    redirects = {rid: find(rid) for rid in groups if rid != find(rid)}
    summary = {'decisionCount': len(decisions), 'reviewedGroups': sum(x['identityStatus'] == 'reviewed' for x in info.values()),
               'pendingNames': sum(bool(d.get('deferredGroupIds')) for d in decisions),
               'pendingGroups': sum(x['identityStatus'] == 'pending' for x in info.values()),
               'mergedGroups': len(redirects), 'confirmedSeparatePairs': sum(len(v) for v in distinct.values()) // 2,
               'decisionsByType': dict(Counter(d['decision'] for d in decisions))}
    return info, redirects, summary
