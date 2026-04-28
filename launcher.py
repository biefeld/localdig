from sys import argv, exit
from utils import *
from subprocess import Popen
from os import scandir


def scale_infrastructure(singles_directory: list[str]) -> None:
    files = scandir(singles_directory)

    servers = [Popen(["python3","server.py", file]) for file in files]
    try:
        for server in servers:
            server.wait()
    except (KeyboardInterrupt, EOFError):
        exit()

def generate_config_files(root_port: int, mapping: dict, taken_ports: set, directory_path: str) -> None:

    tld_nameservers = set()
    auth_nameservers = set()
    hostnames = set()

    for hostname, port in mapping.items():
        tld, auth, _ = split_hostname(hostname)
        
        tld_nameservers.add(tld)
        auth_nameservers.add(auth)
        hostnames.add(hostname)

    # Needs cleaning up further -> inefficeint due to repeated loops
    with open(f"{directory_path}/root.conf", "w") as root_file:
        root_file.write(f"{root_port}\n")

        for tld in tld_nameservers:
            new_port = get_valid_port(taken_ports)
            root_file.write(f"{tld},{new_port}\n")

            with open(f"{directory_path}/tld-{tld}.conf", "w") as tld_file:
                tld_file.write(f"{new_port}\n")

                for auth in auth_nameservers:
                    if tld not in auth:
                        continue
                    
                    new_port = get_valid_port(taken_ports)
                    tld_file.write(f"{auth},{new_port}\n")

                    with open(f"{directory_path}/auth-{auth}.conf", "w") as auth_file:
                        auth_file.write(f"{new_port}\n")

                        for hostname, port in mapping.items():
                            if auth not in hostname:
                                continue

                            auth_file.write(f"{hostname},{port}\n")

    return


def validate_arguments(args: list[str]) -> bool:
    return len(args) == 2

def main(args: list[str]) -> None:
    #Validate arguments, master file and that the directory exists
    if not validate_arguments(args):
        print("INVALID ARGUMENTS")
        return

    master_file = args[0]
    singles_directory = args[1]

    root_port, mapping, taken_ports = valid_master(master_file)

    if not root_port:
        print("INVALID MASTER")
        return

    if not valid_directory(singles_directory):
        print("NON-WRITABLE SINGLE DIR")
        return
    
    generate_config_files(root_port, mapping, taken_ports, singles_directory)

    scale_infrastructure(singles_directory)


if __name__ == "__main__":
    main(argv[1:])
