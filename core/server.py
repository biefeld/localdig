from sys import argv, exit
import signal
import socket
import threading
from core.utils import *


def save_records(conf_path: str, server_port: int, mapping: dict) -> None:
    # Writes over file with whole mapping, not append new
    try:
        with open(conf_path, 'w') as f:
            f.write(f"{server_port}\n")
            for hostname, port in mapping.items():
                f.write(f"{hostname},{port}\n")
    except OSError:
        pass


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


def process_command(request: str, mapping: dict, taken_ports: set) -> str:
    """Mutates mapping/taken_ports, must be called with lock held."""
    command, arguments = request.split(" ")[0][1:], request.split(" ")[1:]
    if command == "EXIT" and not arguments:
        exit()
    elif command == "ADD" and len(arguments) == 2:
        hostname, port = arguments
        if not add_record(hostname, port, mapping, taken_ports):
            return "INVALID"
        return "OK"
    elif command == "DEL" and len(arguments) == 1:
        delete_record(arguments[0], mapping, taken_ports)
        return "OK"
    return "INVALID"


def handle_connection(conn: socket.socket, mapping: dict, taken_ports: set, lock: threading.Lock, conf_path: str, server_port: int) -> None:
    with conn:
        while True:
            try:
                data = conn.recv(1024).decode()
            except OSError:
                break

            if not data:
                break

            for request in data.split("\n")[:-1]:
                if not request:
                    continue

                is_command = (request[0] == "!")
                needs_save = False

                # execute commands/resolve inside lock
                with lock:
                    if is_command:
                        response = process_command(request, mapping, taken_ports)
                        needs_save = (response == "OK")
                    else:
                        response = str(mapping.get(request) or "NXDOMAIN")

                # read/write operations outside lock
                if needs_save:
                    save_records(conf_path, server_port, mapping)

                try:
                    print(f"resolve {request} to {response}", flush=True)
                    conn.sendall((f"{response}\n").encode())
                except OSError:
                    break


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

    # Close gracefully on termination when in subprocess
    signal.signal(signal.SIGTERM, lambda *_: exit(0))

    lock = threading.Lock()
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as server_socket:
        server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        server_socket.bind(('127.0.0.1', server_port))
        server_socket.listen(128) # Default ~5 conn in queue, needs to be higher for many concurrent conn
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