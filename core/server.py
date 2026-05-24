from sys import argv, exit
import socket
import threading
from core.utils import *


def save_records(conf_path: str, server_port: int, mapping: dict) -> None:
    with open(conf_path, 'w') as f:
        f.write(f"{server_port}\n")
        for hostname, port in mapping.items():
            f.write(f"{hostname},{port}\n")


def add_record(hostname: str, port: int, mapping: dict, taken_ports: set) -> bool:
    try:
        port = int(port)
    except ValueError:
        return False
    if not valid_partial_hostname(hostname) or not valid_port(port) or port in taken_ports:
        return False
    mapping[hostname] = port
    taken_ports.add(port)
    return True


def delete_record(hostname: str, mapping: dict, taken_ports: set) -> None:
    if mapping.get(hostname):
        port = mapping.pop(hostname)
        taken_ports.remove(port)


def process_command(request: str, mapping: dict, taken_ports: set, conf_path: str, server_port: int) -> str:
    command, arguments = request.split(" ")[0][1:], request.split(" ")[1:]
    if command == "EXIT" and not arguments:
        exit()
    elif command == "ADD" and len(arguments) == 2:
        hostname, port = arguments
        if not add_record(hostname, port, mapping, taken_ports):
            return "INVALID"
        save_records(conf_path, server_port, mapping)
        return "OK"
    elif command == "DEL" and len(arguments) == 1:
        delete_record(arguments[0], mapping, taken_ports)
        save_records(conf_path, server_port, mapping)
        return "OK"
    return "INVALID"


def handle_connection(conn: socket.socket, mapping: dict, taken_ports: set, lock: threading.Lock, conf_path: str, server_port: int) -> None:
    with conn:
        while True:
            data = conn.recv(1024).decode()
            if not data:
                break
            for request in data.split("\n")[:-1]:
                if not request:
                    continue
                with lock:
                    if request[0] == "!":
                        response = process_command(request, mapping, taken_ports, conf_path, server_port)
                    else:
                        response = str(mapping.get(request) or "NXDOMAIN")
                        print(f"resolve {request} to {response}", flush=True)
                conn.sendall((f"{response}\n").encode())


def valid_args(args: list[str]) -> bool:
    return len(args) == 1


def main(args: list[str]) -> None:
    if not valid_args(args):
        print("INVALID ARGUMENTS", flush=True)
        return

    conf_path = args[0]
    server_port, mapping, taken_ports = valid_single(conf_path)
    if not server_port:
        print("INVALID CONFIGURATION")
        return

    lock = threading.Lock()
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as server_socket:
        server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        server_socket.bind(('127.0.0.1', server_port))
        server_socket.listen()
        while True:
            try:
                conn, addr = server_socket.accept()
                thread = threading.Thread(
                    target=handle_connection,
                    args=(conn, mapping, taken_ports, lock, conf_path, server_port),
                    daemon=True,
                )
                thread.start()
            except (KeyboardInterrupt, EOFError):
                exit()


if __name__ == "__main__":
    main(argv[1:])