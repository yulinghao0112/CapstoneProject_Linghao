import React from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button } from 'reactstrap';

const AlertModal = ({ isOpen, toggle, title, message, onConfirm }) => {
    return (
        <Modal isOpen={isOpen} toggle={toggle} centered>
            <ModalHeader toggle={toggle}>{title}</ModalHeader>
            <ModalBody>
                <p>{message}</p>
            </ModalBody>
            <ModalFooter>
                <Button color="primary" onClick={onConfirm}>OK</Button>
            </ModalFooter>
        </Modal>
    );
};

export default AlertModal;
