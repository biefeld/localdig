from sys import argv, exit
from subprocess import Popen
from os import scandir
from pathlib import Path
import json

from core.utils import *
import core.server as _server


ROOT_DIR = Path(__file__).parent.parent


def scale_infrastructure(singles_directory: list[str]) -> None:
    files = scandir(singles_directory)

    servers = [Popen(["python3", _server.__file__, file]) for file in files]
    try:
        for server in servers:
            server.wait()
    except (KeyboardInterrupt, EOFError):
        exit()

def expand_mapping(mapping: dict) -> dict:
    """
    Converts
        www.linear.app 17001
        api.linear.app 17002
    to
        {
            "app": {
                "linear.app": [
                    [
                        "www.linear.app",
                        17001
                    ],
                    [
                        "api.linear.app",
                        17002
                    ]
                ]
            },
            ...
        }
    in O(n) time
    """
    expanded = {}
    for hostname, port in mapping.items():
        tld, auth, _ = split_hostname(hostname)
        
        # Initialize nested structures if they do not exist
        auth_dict = expanded.setdefault(tld, {})
        host_list = auth_dict.setdefault(auth, [])
        
        host_list.append((hostname, port))

    return expanded


def generate_config_files(root_port: int, mapping: dict, taken_ports: set, directory_path: str) -> None:
    hierarchy = expand_mapping(mapping)
    
    # No longer O(n^3), just do one pass over each record/subrecord in dict
    with open(f"{directory_path}/root.conf", "w") as root_file:
        root_file.write(f"{root_port}\n")

        for tld, auth_dict in hierarchy.items():
            tld_port = get_valid_port(taken_ports)
            root_file.write(f"{tld},{tld_port}\n")

            with open(f"{directory_path}/tld-{tld}.conf", "w") as tld_file:
                tld_file.write(f"{tld_port}\n")

                for auth, host_list in auth_dict.items():
                    auth_port = get_valid_port(taken_ports)
                    tld_file.write(f"{auth},{auth_port}\n")

                    with open(f"{directory_path}/auth-{auth}.conf", "w") as auth_file:
                        auth_file.write(f"{auth_port}\n")
                        
                        for hostname, port in host_list:
                            auth_file.write(f"{hostname},{port}\n")


def validate_arguments(args: list[str]) -> bool:
    return len(args) == 2

def main(args: list[str]) -> None:
    #Validate arguments, master file and that the directory exists
    if not validate_arguments(args):
        print("INVALID ARGUMENTS\nexample usage: python3 dns_core/launcher.py db/master.conf db/singles")
        return

    master_file = Path(ROOT_DIR / args[0])
    singles_directory = Path(ROOT_DIR / args[1])

    root_port, mapping, taken_ports = valid_master(master_file)

    if not root_port:
        print("INVALID MASTER")
        return

    if not valid_directory(singles_directory):
        try: singles_directory.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            print ("NON-WRITABLE SINGLE DIR")
            return
    
    generate_config_files(root_port, mapping, taken_ports, singles_directory)

    scale_infrastructure(singles_directory)


if __name__ == "__main__":
    main(argv[1:])
