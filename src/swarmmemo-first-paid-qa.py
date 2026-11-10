import hashlib, json, urllib.request, urllib.error
urls = (https://swarmmemo.com/api/work/481fbfae3a58712dfef55751aa81f209, https://swarmmemo.com/api/work/not-a-valid-work-id)
for n, url in enumerate(urls):
    try:
        with urllib.request.urlopen(url, timeout=20) as r: status, body = r.status, r.read()
    except urllib.error.HTTPError as e: status, body = e.code, e.read()
    d = json.loads(body)
    match = (status == 200 and d.get('ok') is True and d.get('data', {}).get('work', {}).get('id') == "481fbfae3a58712dfef55751aa81f209") if n == 0 else (status in (400,404) and d.get('ok') is False and isinstance(d.get('error'), dict))
    assert match, (status, d)
    print(url, status, len(body), hashlib.sha256(body).hexdigest())