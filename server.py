from sys import argv, exit
import socket
from utils import *


# Mutates mapping, taken_ports
def add_record(hostname: str, port: int, mapping: dict, taken_ports: set) -> bool:
    try:
        port = int(port)
    except ValueError:
        return False

    if not valid_partial_hostname(hostname) or not valid_port(port) or port in taken_ports:
        return False

    # Mutable
    mapping[hostname] = port
    taken_ports.add(port)

    return True

# Mutates mapping, taken_ports
def delete_record(hostname: str, mapping: dict, taken_ports: set) -> None:
    if mapping.get(hostname):
        port = mapping.pop(hostname)
        taken_ports.remove(port)

def process_command(request: str, mapping: dict, taken_ports: set) -> None:
    command, arguments = request.split(" ")[0][1:], request.split(" ")[1:] 

    if command == "EXIT" and not arguments:
        exit()
    
    if command == "ADD" and len(arguments) == 2:
        hostname, port = arguments

        if not add_record(hostname, port, mapping, taken_ports):
            print("INVALID",flush=True)
        return

    if command == "DEL" and len(arguments) == 1:
        hostname = arguments[0]
        delete_record(hostname, mapping, taken_ports)
        return

    print("INVALID",flush=True)

def handle_request(server_socket: socket.socket, mapping: dict, taken_ports: set) -> None:
    conn, addr = server_socket.accept()

    # Once connected, always be waiting for data
    while True:
        data = conn.recv(1024).decode()

        if not data:
            break

        requests = data.split("\n")[:-1]

        for request in requests:
            if request and request[0] == "!":
                process_command(request, mapping, taken_ports)
            else:
                response = mapping.get(request) or "NXDOMAIN"
                print(f"resolve {request} to {response}", flush=True)
                conn.sendall((f"{response}\n").encode()) 


# Expect [config_file: string]
def valid_args(args: list[str]) -> bool:
    return len(args) == 1


def main(args: list[str]) -> None:
    if not valid_args(args):
        print("INVALID ARGUMENTS", flush=True)
        return
    
    server_port, mapping, taken_ports = valid_single(args[0])

    if not server_port:
        print("INVALID CONFIGURATION")
        return
    
    # Create new socket using TCP (SOCK_STREAM)
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as server_socket:
        server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        server_socket.bind(('127.0.0.1', server_port))
        server_socket.listen()

        # Always be accepting connections
        while True:
            try:
                handle_request(server_socket, mapping, taken_ports)
            except (KeyboardInterrupt, EOFError):
                exit()


if __name__ == "__main__":
    main(argv[1:])
