import pytest
from verifier import verify,ABSTAIN
from synth_pairs import synthesize
I={"query":"What is the valve position?","passages":["The valve position is closed. Do not open the valve.","The pump is off."]}
@pytest.mark.parametrize("answer,expected",[
("The valve position is closed [1].",1),("Valve position is closed [1]",1),("The pump is off [2].",1),
("The valve position is open [1].",0),("Open the valve [1].",0),("Do not open the valve [1].",1),
("The valve position is closed [0].",0),("The valve position is closed [3].",0),("The valve position is closed [-1].",0),
("The valve position is closed [x].",0),("The valve position is closed.",0),("The valve position is closed [2].",0),
("The valve position is closed [1]; The pump is off [2].",1),("The valve position is closed [1]; pump is on [2].",0),
("The valve position is closed [1]; Paris is the capital of France [1].",0),("The valve position is closed [1]; disconnect the pump [2].",0),
("The valve position is closed [1] [99].",0),("The valve position is closed [1] [2].",1),
("",0),("  ",0),("[1]",0),("The valve position is closed [1];",1),
("closed valve position [1].",0),("The valve position is not closed [1].",0),("The pump is off [1].",0),
("The valve position is closed [1]; The pump is off.",0),("The valve position is closed [1]. The pump is off [2].",1),
("The valve position is closed [1]. The pump is on [2].",0),(ABSTAIN,0),
("The valve position is closed [1]; "+ABSTAIN,0),("word "*121+"[1]",0),
("The valve position is closed [01].",1),("The valve position is closed [1] []",0)])
def test_grounding(answer,expected):assert verify(I,answer)==expected
def test_absent():assert verify({"query":"What is the moon temperature?","passages":["The valve is closed."]},ABSTAIN)==1
@pytest.mark.parametrize("item",[{},{"query":"q","passages":[]},{"query":"q","passages":[None]},{"query":"q","passages":["x"]*9},None])
def test_malformed(item):assert verify(item,ABSTAIN)==0
def test_numeric():
    item={"query":"What is the limit?","passages":["The limit is 15 volts."]}
    assert verify(item,"The limit is 15 volts [1].")==1
    assert verify(item,"The limit is 51 volts [1].")==0
def test_pairs():
    item={**I,"gold_answer":"The valve position is closed [1]."}
    pairs=synthesize(item)
    assert len(pairs)==3
    assert pairs==synthesize(item)
    for p in pairs:assert verify(item,p["chosen"])==1 and verify(item,p["rejected"])==0
def test_skip_bad_seed():assert synthesize({**I,"gold_answer":"Unverified answer"})==[]
