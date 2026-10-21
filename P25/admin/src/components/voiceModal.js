import React from 'react';
import { Modal, ModalBody, ModalFooter, Button } from 'reactstrap';

const VoiceModal = ({ isOpen, toggle, title, message, onConfirm }) => {
    return (
        <Modal isOpen={isOpen} backdrop="static" centered>
            <ModalBody className="text-center" style={{ fontSize: 18, paddingTop: 30, paddingBottom: 10 }}>
                <strong>{title}</strong>
                <div className="mt-3">{message}</div>
            </ModalBody>
            <ModalFooter className="justify-content-center" style={{ paddingBottom: 30 }}>
                <Button color="danger" onClick={onConfirm}>
                    Confirm
                </Button>
                <Button color="secondary" onClick={toggle}>
                    Cancel
                </Button>
            </ModalFooter>
        </Modal>
    );
};

export default VoiceModal;
