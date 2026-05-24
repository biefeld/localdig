from sys import argv
from core.utils import valid_master, valid_single, valid_directory
import pathlib

def get_root_label(hostname: str) -> str:
    return hostname.split('.')[-1]


def get_tld_name(hostname: str) -> str:
    parts = hostname.split('.')
    return '.'.join(parts[-2:])


def classify_file(mapping: dict[str, int]) -> str | None:
    depths = {len(hostname.split('.')) for hostname in mapping}
    if depths == {1}:
        return 'root'
    if depths == {2}:
        return 'tld'
    if depths and min(depths) >= 3:
        return 'auth'
    return None


def parse_single_files(directory_path: str):
    root_file = None
    tld_files = []
    auth_files = []

    for path in pathlib.Path(directory_path).glob('*.conf'):
        server_port, mapping, _ = valid_single(str(path))
        if not server_port:
            return None, None, None

        file_type = classify_file(mapping)
        if file_type == 'root':
            if root_file is not None:
                return None, None, None
            root_file = (path, server_port, mapping)
        elif file_type == 'tld':
            tld_files.append((path, server_port, mapping))
        elif file_type == 'auth':
            auth_files.append((path, server_port, mapping))
        else:
            return None, None, None

    return root_file, tld_files, auth_files


def validate_root_file(root_port: int, root_file, master_mapping: dict[str, int]) -> bool:
    if root_file is None:
        return False

    _, root_server_port, root_mapping = root_file
    if root_server_port != root_port:
        return False

    expected_roots = {get_root_label(hostname) for hostname in master_mapping}
    return set(root_mapping.keys()) == expected_roots


def validate_tld_files(root_mapping: dict[str, int], master_mapping: dict[str, int], tld_files: list):
    tld_by_root = {}

    for _, tld_server_port, tld_mapping in tld_files:
        roots = {get_root_label(hostname) for hostname in tld_mapping}
        if len(roots) != 1:
            return None

        root_label = next(iter(roots))
        if tld_server_port != root_mapping.get(root_label):
            return None

        expected_auths = {
            get_tld_name(hostname)
            for hostname in master_mapping
            if get_root_label(hostname) == root_label
        }
        if set(tld_mapping.keys()) != expected_auths:
            return None

        tld_by_root[root_label] = tld_mapping

    return tld_by_root


def validate_auth_files(master_mapping: dict[str, int], tld_lookup: dict[str, int], auth_files: list) -> bool:
    expected_tlds = {get_tld_name(hostname) for hostname in master_mapping}
    all_auth_names = set()

    for _, _, auth_mapping in auth_files:
        auth_names = {get_tld_name(hostname) for hostname in auth_mapping}
        if len(auth_names) != 1:
            return False
        all_auth_names.update(auth_names)

    if all_auth_names != expected_tlds:
        return False

    for _, auth_server_port, auth_mapping in auth_files:
        auth_name = get_tld_name(next(iter(auth_mapping)))
        expected_hostnames = {
            hostname
            for hostname in master_mapping
            if get_tld_name(hostname) == auth_name
        }
        if set(auth_mapping.keys()) != expected_hostnames:
            return False

        if auth_server_port != tld_lookup.get(auth_name):
            return False

        for hostname, port in auth_mapping.items():
            if master_mapping.get(hostname) != port:
                return False

    return True


def valid_configuration(master_filepath: str, directory_path: str) -> bool:
    root_port, master_mapping, _ = valid_master(master_filepath)
    if not root_port:
        return False

    root_file, tld_files, auth_files = parse_single_files(directory_path)
    if root_file is None:
        return False

    if not validate_root_file(root_port, root_file, master_mapping):
        return False

    _, _, root_mapping = root_file
    tld_by_root = validate_tld_files(root_mapping, master_mapping, tld_files)
    if tld_by_root is None:
        return False

    return validate_auth_files(master_mapping, {
        auth_name: port
        for tld_mapping in tld_by_root.values()
        for auth_name, port in tld_mapping.items()
    }, auth_files)


def validate_arguments(args: list[str]) -> bool:
    return len(args) == 2


def main(args: list[str]) -> None:
    if not validate_arguments(args):
        print('INVALID ARGUMENTS')
        return

    master_file = args[0]
    singles_directory = args[1]

    root_port, _, _ = valid_master(master_file)
    if not root_port:
        print('INVALID MASTER')
        return

    if not valid_directory(singles_directory):
        print('NON-WRITABLE SINGLE DIR')
        return

    if not valid_configuration(master_file, singles_directory):
        print('neq')
        return

    print('eq')


if __name__ == '__main__':
    main(argv[1:])
