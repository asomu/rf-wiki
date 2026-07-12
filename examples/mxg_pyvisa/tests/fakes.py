from typing import Dict, List, Optional


class FakeTransport:
    def __init__(
        self,
        idn: str = "Keysight Technologies,N5182B,MY00000001,B.01.96",
        options: str = "506,656",
        error_responses: Optional[List[str]] = None,
        preexisting_error_responses: Optional[List[str]] = None,
    ) -> None:
        self.writes: List[str] = []
        self.queries: List[str] = []
        self.raw_writes: List[bytes] = []
        self.history: List[str] = []
        self.closed = False
        self.responses: Dict[str, str] = {
            "*IDN?": idn,
            "*OPT?": options,
            "*OPC?": "1",
            "SOUR:FREQ:CW?": "1000000000",
            "SOUR:POW:LEV:IMM:AMPL?": "-30",
            "OUTP?": "0",
            "OUTP:MOD?": "0",
            "SOUR:RAD:ARB:WAV?": '"WFM1:RF_WIKI_IQ"',
            "SOUR:RAD:ARB:SCL:RATE?": "100000000",
            "SOUR:RAD:ARB:RSC?": "70",
            "SOUR:RAD:ARB:STAT?": "0",
        }
        self.error_responses = list(
            preexisting_error_responses or ['+0,"No error"']
        )
        self.post_clear_error_responses = list(
            error_responses or ['+0,"No error"']
        )

    def write(self, command: str) -> None:
        self.writes.append(command)
        self.history.append("WRITE {}".format(command))
        normalized = command.strip()
        upper = normalized.upper()
        if upper == "*CLS":
            self.error_responses = list(self.post_clear_error_responses)
        elif upper.startswith("SOUR:FREQ:CW "):
            self.responses["SOUR:FREQ:CW?"] = normalized.split(None, 1)[1].upper().replace(
                "HZ", ""
            )
        elif upper.startswith("SOUR:POW:LEV:IMM:AMPL "):
            self.responses["SOUR:POW:LEV:IMM:AMPL?"] = normalized.split(None, 1)[
                1
            ].upper().replace("DBM", "")
        elif upper in {"OUTP ON", "OUTP:STAT ON"}:
            self.responses["OUTP?"] = "1"
        elif upper in {"OUTP OFF", "OUTP:STAT OFF"}:
            self.responses["OUTP?"] = "0"
        elif upper == "OUTP:MOD ON":
            self.responses["OUTP:MOD?"] = "1"
        elif upper == "OUTP:MOD OFF":
            self.responses["OUTP:MOD?"] = "0"
        elif upper.startswith("SOUR:RAD:ARB:WAV "):
            self.responses["SOUR:RAD:ARB:WAV?"] = normalized.split(None, 1)[1]
        elif upper.startswith("SOUR:RAD:ARB:SCL:RATE "):
            self.responses["SOUR:RAD:ARB:SCL:RATE?"] = normalized.split(None, 1)[
                1
            ].upper().replace("HZ", "")
        elif upper.startswith("SOUR:RAD:ARB:RSC "):
            self.responses["SOUR:RAD:ARB:RSC?"] = normalized.split(None, 1)[1]
        elif upper == "SOUR:RAD:ARB:STAT ON":
            self.responses["SOUR:RAD:ARB:STAT?"] = "1"
        elif upper == "SOUR:RAD:ARB:STAT OFF":
            self.responses["SOUR:RAD:ARB:STAT?"] = "0"

    def query(self, command: str) -> str:
        self.queries.append(command)
        self.history.append("QUERY {}".format(command))
        if command == "SYST:ERR?":
            if len(self.error_responses) > 1:
                return self.error_responses.pop(0)
            return self.error_responses[0]
        return self.responses[command]

    def write_raw(self, data: bytes) -> None:
        self.raw_writes.append(data)
        self.history.append("WRITE_RAW {} bytes".format(len(data)))

    def close(self) -> None:
        self.closed = True
        self.history.append("CLOSE")
