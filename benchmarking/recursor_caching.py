from sys import argv, exit
import socket
from utils import *
from cache import Cache
import datetime as dt
import threading as th


def resolve_hostname(root_port: int, root_query: str, tld_query: str, auth_query: str, cache: Cache, cache_ttl: float):

        cache_record = cache.resolve(auth_query)
        if cache_record:
            print(cache_record.port)
            return
    
        tld_port = query_next_port(root_port, root_query, nameserver_type="ROOT")
        if ("NXDOMAIN" in tld_port):
            print(tld_port.strip("\n"))
            return

        auth_port = query_next_port(int(tld_port), tld_query, nameserver_type="TLD")
        if ("NXDOMAIN" in auth_port):
            print(auth_port.strip("\n"))
            return

        resolved_port = query_next_port(int(auth_port), auth_query, nameserver_type='AUTH')
        print(resolved_port.strip("\n"))
        
        # Placeholder expiry time
        cache.add(auth_query, resolved_port.strip("\n"), dt.datetime.now() + dt.timedelta(seconds=cache_ttl))


def query_next_port(current_port: int, query: str, nameserver_type: str) -> str:

    #Create new socket using TCP (SOCK_STREAM)
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as server_socket:
        try:
            server_socket.connect(('127.0.0.1', current_port))
            server_socket.sendall(query.encode() + b'\n')
            next_port = server_socket.recv(1024).decode()
            return next_port
        except TimeoutError:
            return "NXDOMAIN"
        except ConnectionRefusedError:
                print(f"FAILED TO CONNECT TO {nameserver_type}")
                exit()


# Expecting [root_port: int, timeout: float, cache_ttl: float]
def validate_arguments(args: list[str]) -> bool:
    if len(args) != 3:
        return False
    
    # Attempt type cast
    try:
        root_port = int(args[0])
        float(args[1])
        float(args[2])
    except ValueError:
        return False
    
    return valid_port(root_port)


def main(args: list[str]) -> None:
    if not validate_arguments(args):
        print("INVALID ARGUMENTS")
        return
    
    root_port = int(args[0])
    timeout = float(args[1])
    cache_ttl = float(args[2])

    cache = Cache(update_period=5.0)

    t = th.Thread(target=cache.update, daemon=True)
    t.start()

    while True:
        try:
            target_hostname = input("")
        except (KeyboardInterrupt, EOFError):
            exit()

        if not valid_hostname(target_hostname):
            print("INVALID")
            continue

        root_query, tld_query, auth_query = split_hostname(target_hostname)

        resolve_hostname(root_port, root_query, tld_query, auth_query, cache, cache_ttl)


if __name__ == "__main__":
    main(argv[1:])
