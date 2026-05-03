import datetime as dt
import threading as th
import time

class Record:

    def __init__(self, port: str, expiry: dt.datetime):
        self.port = port
        self.expiry = expiry

    def __str__(self):
        return f"{self.port} (expires {self.expiry.strftime('%d/%m/%y %H:%M:%S')})"

    def is_expired(self) -> bool:
        return self.expiry < dt.datetime.now()



class Cache:

    def __init__(self, update_period: float):
        self.cache = {}
        self._lock = th.Lock()
        self.update_period = update_period

    def __str__(self):
        with self._lock:
            if not self.cache:
                return "Empty Cache"
            return "\n".join(f"{hostname} -> {record}" for hostname, record in self.cache.items())

    def resolve(self, hostname:str) -> Record:
        with self._lock:
            if self.cache.get(hostname):
                return self.cache[hostname]
        return None
    
    def add(self, hostname: str, port: str, expiry: dt.datetime) -> None:
        with self._lock:
            self.cache[hostname] = Record(port, expiry)

    def update(self) -> None:
        while True:
            with self._lock:
                for hostname in list(self.cache):
                    if self.cache[hostname].is_expired():
                        self.cache.pop(hostname)
                        print(f"{hostname} cache record expired.")
            time.sleep(self.update_period)