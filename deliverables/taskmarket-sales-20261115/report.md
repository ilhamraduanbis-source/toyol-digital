# Sales findings

1. Sales revenue rose from $105,840 in January–March to $153,979 in October–December, an increase of 45.5%. December was the highest-revenue month at $54,121.
2. The six months labelled retail contributed $280,744 of the year's $502,400 revenue, or 55.9%. The six online months contributed $221,656.
3. The business recorded 120 refunds against 2,237 units sold, equivalent to 5.4 recorded refunds per 100 units sold.

## Reproducible calculation

```python
q1 = sum([31678, 33844, 40318])
q4 = sum([48290, 51568, 54121])
print(q1, q4, round(100 * (q4 / q1 - 1), 1))
# 105840 153979 45.5
```

## Caveat

Each month has only one channel label, and the data contain no costs or sales by product. The retail total therefore cannot establish that switching channels caused revenue growth or that retail was more profitable.
