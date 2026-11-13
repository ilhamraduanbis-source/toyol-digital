"""Standard-library CSV/JSON conversion for flat tabular data."""
import argparse
import csv
import json
import math
from pathlib import Path


def csv_to_json(source, target, delimiter=None, indent=2):
    with Path(source).open(encoding='utf-8-sig', newline='') as f:
        sample = f.read(8192)
        f.seek(0)
        if not sample.strip():
            raise ValueError('Empty CSV input')
        if delimiter is None:
            try:
                delimiter = csv.Sniffer().sniff(sample, delimiters=',;\t|').delimiter
            except csv.Error:
                delimiter = ','
        if len(delimiter) != 1:
            raise ValueError('Delimiter must be a single character')
        reader = csv.reader(f, delimiter=delimiter, strict=True)
        headers = next(reader, [])
        if not headers or any(not h.strip() for h in headers) or len(set(headers)) != len(headers):
            raise ValueError('CSV headers must be unique and nonempty')
        rows = []
        for row in reader:
            if not row:
                continue
            if len(row) != len(headers):
                raise ValueError(f'Line {reader.line_num}: expected {len(headers)} cells, got {len(row)}')
            rows.append(dict(zip(headers, row)))
    with Path(target).open('w', encoding='utf-8', newline='') as f:
        json.dump(rows, f, ensure_ascii=False, indent=indent, allow_nan=False)
        f.write('\n')


def json_to_csv(source, target, delimiter=','):
    if len(delimiter) != 1:
        raise ValueError('Delimiter must be a single character')
    with Path(source).open(encoding='utf-8-sig') as f:
        rows = json.load(f)
    if not isinstance(rows, list) or any(not isinstance(r, dict) for r in rows):
        raise ValueError('JSON must be an array of flat objects')
    fields = list(dict.fromkeys(k for row in rows for k in row))
    for row in rows:
        for val in row.values():
            if isinstance(val, (dict, list)):
                raise ValueError('Nested objects and arrays are not supported')
            if isinstance(val, float) and not math.isfinite(val):
                raise ValueError('Non-finite numbers are not supported')
    with Path(target).open('w', encoding='utf-8', newline='') as f:
        if fields:
            writer = csv.DictWriter(f, fieldnames=fields, delimiter=delimiter, lineterminator='\r\n', restval='')
            writer.writeheader()
            writer.writerows(rows)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('direction', choices=['csv-to-json', 'json-to-csv'])
    p.add_argument('input', type=Path)
    p.add_argument('output', type=Path)
    p.add_argument('--delimiter', help='Single-character delimiter; CSV input defaults to autodetection')
    p.add_argument('--indent', type=int, choices=range(0, 9), default=2, help='JSON indentation (0 for compact lines)')
    a = p.parse_args()
    try:
        if a.input.resolve() == a.output.resolve():
            raise ValueError('Input and output must be different files')
        if a.direction == 'csv-to-json':
            csv_to_json(a.input, a.output, a.delimiter, a.indent)
        else:
            json_to_csv(a.input, a.output, a.delimiter or ',')
    except (OSError, ValueError, csv.Error) as e:
        p.exit(2, f'Conversion failed: {e}\n')


if __name__ == '__main__':
    main()
